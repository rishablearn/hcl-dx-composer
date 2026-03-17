/**
 * AI Image Generation Service
 * Supports OpenAI DALL-E and Stability AI for generating images/creatives
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const db = require('../config/database');

// Credit/cost estimates per provider (approximate)
const PROVIDER_COSTS = {
  openai: {
    'dall-e-3': {
      '1024x1024': { standard: 0.040, hd: 0.080 },
      '1792x1024': { standard: 0.080, hd: 0.120 },
      '1024x1792': { standard: 0.080, hd: 0.120 }
    }
  },
  stability: {
    'stable-diffusion-xl-1024-v1-0': {
      base: 0.002, // per step
      default_steps: 30
    }
  },
  pollinations: {
    default: 0 // Free
  }
};

class AIService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.stabilityApiKey = process.env.STABILITY_API_KEY;
    this.uploadPath = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');
    
    // Set default provider based on available API keys
    const configuredProvider = process.env.AI_IMAGE_PROVIDER;
    if (configuredProvider === 'openai' && this.openaiApiKey) {
      this.defaultProvider = 'openai';
    } else if (configuredProvider === 'stability' && this.stabilityApiKey) {
      this.defaultProvider = 'stability';
    } else if (configuredProvider === 'pollinations' || !this.openaiApiKey) {
      this.defaultProvider = 'pollinations'; // Free fallback
    } else {
      this.defaultProvider = 'pollinations';
    }
    
    logger.info(`AI Service initialized with default provider: ${this.defaultProvider}`);
  }

  /**
   * Generate image using OpenAI DALL-E 3
   */
  async generateWithDallE(prompt, options = {}) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const {
      size = '1024x1024',
      quality = 'standard',
      style = 'vivid',
      n = 1
    } = options;

    try {
      logger.info(`Generating image with DALL-E: "${prompt.substring(0, 50)}..."`);

      const response = await axios.post(
        'https://api.openai.com/v1/images/generations',
        {
          model: 'dall-e-3',
          prompt,
          n,
          size,
          quality,
          style,
          response_format: 'url'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 120000
        }
      );

      const images = response.data.data.map(img => ({
        url: img.url,
        revisedPrompt: img.revised_prompt
      }));

      logger.info(`DALL-E generated ${images.length} image(s)`);
      return images;
    } catch (error) {
      logger.error('DALL-E generation failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Image generation failed');
    }
  }

  /**
   * Generate image using Stability AI
   */
  async generateWithStability(prompt, options = {}) {
    if (!this.stabilityApiKey) {
      throw new Error('Stability AI API key not configured');
    }

    const {
      width = 1024,
      height = 1024,
      steps = 30,
      cfgScale = 7,
      style = 'photographic'
    } = options;

    try {
      logger.info(`Generating image with Stability AI: "${prompt.substring(0, 50)}..."`);

      const response = await axios.post(
        'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
        {
          text_prompts: [{ text: prompt, weight: 1 }],
          cfg_scale: cfgScale,
          width,
          height,
          steps,
          style_preset: style
        },
        {
          headers: {
            'Authorization': `Bearer ${this.stabilityApiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 120000
        }
      );

      const images = response.data.artifacts.map(artifact => ({
        base64: artifact.base64,
        seed: artifact.seed
      }));

      logger.info(`Stability AI generated ${images.length} image(s)`);
      return images;
    } catch (error) {
      logger.error('Stability AI generation failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Image generation failed');
    }
  }

  /**
   * Generate image using Pollinations AI (FREE - no API key required)
   */
  async generateWithPollinations(prompt, options = {}) {
    // Parse size string if provided
    let width = options.width || 1024;
    let height = options.height || 1024;
    
    if (options.size && typeof options.size === 'string' && options.size.includes('x')) {
      const [w, h] = options.size.split('x').map(Number);
      if (w && h) {
        width = w;
        height = h;
      }
    }

    const model = options.model || 'flux';
    const seed = options.seed || Math.floor(Math.random() * 1000000);

    try {
      logger.info(`Generating image with Pollinations AI (model: ${model}): "${prompt.substring(0, 50)}..."`);

      // Pollinations uses URL-based API - encode the prompt
      const encodedPrompt = encodeURIComponent(prompt);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model}&seed=${seed}&nologo=true`;

      logger.info(`Pollinations URL: ${imageUrl}`);

      // For Pollinations, we just return the URL - it generates on first access
      // The image will be generated when downloaded
      return [{
        url: imageUrl,
        seed,
        model,
        width,
        height
      }];
    } catch (error) {
      logger.error('Pollinations AI generation failed:', error.message);
      throw new Error('Pollinations image generation failed - ' + error.message);
    }
  }

  /**
   * Generate image using the configured provider
   */
  async generateImage(prompt, options = {}) {
    const provider = options.provider || this.defaultProvider;

    switch (provider) {
      case 'openai':
      case 'dalle':
        return this.generateWithDallE(prompt, options);
      case 'stability':
        return this.generateWithStability(prompt, options);
      case 'pollinations':
        return this.generateWithPollinations(prompt, options);
      default:
        // Fallback to Pollinations if unknown provider
        logger.warn(`Unknown provider ${provider}, falling back to Pollinations`);
        return this.generateWithPollinations(prompt, options);
    }
  }

  /**
   * Download image from URL and save to uploads folder
   */
  async downloadAndSaveImage(imageUrl, filename = null) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000
      });

      const contentType = response.headers['content-type'] || 'image/png';
      const extension = contentType.includes('jpeg') ? 'jpg' : 'png';
      const savedFilename = filename || `ai_generated_${uuidv4()}.${extension}`;
      
      // Ensure ai-generated subdirectory exists
      const aiDir = path.join(this.uploadPath, 'ai-generated');
      if (!fs.existsSync(aiDir)) {
        fs.mkdirSync(aiDir, { recursive: true });
      }

      const filePath = path.join(aiDir, savedFilename);
      fs.writeFileSync(filePath, response.data);

      logger.info(`AI image saved: ${savedFilename}`);

      return {
        filename: savedFilename,
        path: `/ai-generated/${savedFilename}`,
        fullPath: filePath,
        size: response.data.length,
        mimeType: contentType
      };
    } catch (error) {
      logger.error('Failed to download AI image:', error.message);
      throw new Error('Failed to save generated image');
    }
  }

  /**
   * Save base64 image to uploads folder
   */
  async saveBase64Image(base64Data, filename = null) {
    try {
      const savedFilename = filename || `ai_generated_${uuidv4()}.png`;
      
      // Ensure ai-generated subdirectory exists
      const aiDir = path.join(this.uploadPath, 'ai-generated');
      if (!fs.existsSync(aiDir)) {
        fs.mkdirSync(aiDir, { recursive: true });
      }

      const filePath = path.join(aiDir, savedFilename);
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);

      logger.info(`AI image saved from base64: ${savedFilename}`);

      return {
        filename: savedFilename,
        path: `/ai-generated/${savedFilename}`,
        fullPath: filePath,
        size: buffer.length,
        mimeType: 'image/png'
      };
    } catch (error) {
      logger.error('Failed to save base64 image:', error.message);
      throw new Error('Failed to save generated image');
    }
  }

  /**
   * Generate and save image, returning file info
   */
  async generateAndSave(prompt, options = {}) {
    const provider = options.provider || this.defaultProvider;
    const images = await this.generateImage(prompt, options);
    const savedImages = [];

    for (const image of images) {
      let savedImage;
      
      if (image.url) {
        savedImage = await this.downloadAndSaveImage(image.url);
        savedImage.revisedPrompt = image.revisedPrompt;
      } else if (image.base64) {
        savedImage = await this.saveBase64Image(image.base64);
        savedImage.seed = image.seed;
      }

      savedImage.provider = provider;
      savedImage.originalPrompt = prompt;
      savedImages.push(savedImage);
    }

    return savedImages;
  }

  /**
   * Get available AI providers and their status
   */
  getAvailableProviders() {
    return {
      pollinations: {
        available: true, // Always available - no API key required
        name: 'Pollinations AI (Free)',
        models: ['flux', 'turbo', 'flux-realism', 'flux-anime', 'flux-3d', 'any-dark', 'flux-pro'],
        sizes: ['1024x1024', '1280x720', '720x1280', '512x512'],
        styles: ['default'],
        description: 'Free AI image generation - no API key required'
      },
      openai: {
        available: !!this.openaiApiKey,
        name: 'OpenAI DALL-E 3',
        models: ['dall-e-3'],
        sizes: ['1024x1024', '1792x1024', '1024x1792'],
        styles: ['vivid', 'natural'],
        description: 'High quality images - requires API key'
      },
      stability: {
        available: !!this.stabilityApiKey,
        name: 'Stability AI SDXL',
        models: ['stable-diffusion-xl-1024-v1-0'],
        sizes: ['1024x1024', '1152x896', '896x1152', '1216x832', '832x1216'],
        styles: ['photographic', 'digital-art', 'anime', 'comic-book', 'fantasy-art', 'line-art', 'cinematic'],
        description: 'Professional quality - requires API key'
      },
      default: this.defaultProvider
    };
  }

  /**
   * Generate creative variations based on a theme
   */
  async generateCreativeSet(theme, options = {}) {
    const {
      count = 3,
      style = 'corporate',
      brand = 'Bharat Petroleum'
    } = options;

    const prompts = this.generatePromptVariations(theme, style, brand, count);
    const results = [];

    for (const prompt of prompts) {
      try {
        const images = await this.generateAndSave(prompt, options);
        results.push(...images.map(img => ({ ...img, theme, style })));
      } catch (error) {
        logger.error(`Failed to generate variation: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Generate prompt variations for creative sets
   */
  generatePromptVariations(theme, style, brand, count) {
    const styleGuides = {
      corporate: `Professional corporate style with clean lines and ${brand} brand colors (green and yellow). Modern and trustworthy aesthetic.`,
      marketing: `Eye-catching marketing material style with bold colors and dynamic composition. ${brand} branding elements.`,
      social: `Social media optimized design with vibrant colors and engaging visuals. Suitable for ${brand} digital campaigns.`,
      minimal: `Minimalist design with plenty of white space. Subtle ${brand} brand integration. Clean and elegant.`,
      energetic: `High-energy design with dynamic elements representing fuel and motion. ${brand} corporate identity.`
    };

    const guide = styleGuides[style] || styleGuides.corporate;
    const variations = [];

    for (let i = 0; i < count; i++) {
      const variation = i === 0 
        ? `${theme}. ${guide}` 
        : `${theme} - variation ${i + 1}. ${guide} Different composition and perspective.`;
      variations.push(variation);
    }

    return variations;
  }

  // ===========================================================================
  // Usage Tracking Methods
  // ===========================================================================

  /**
   * Calculate estimated cost for a generation request
   */
  calculateEstimatedCost(provider, options = {}) {
    const { size = '1024x1024', quality = 'standard', steps = 30, model } = options;

    try {
      if (provider === 'openai') {
        const modelCosts = PROVIDER_COSTS.openai['dall-e-3'];
        const sizeCost = modelCosts[size] || modelCosts['1024x1024'];
        return sizeCost[quality] || sizeCost.standard;
      }

      if (provider === 'stability') {
        const stabilityCosts = PROVIDER_COSTS.stability['stable-diffusion-xl-1024-v1-0'];
        return stabilityCosts.base * steps;
      }

      // Pollinations is free
      return 0;
    } catch (error) {
      logger.warn(`Could not calculate cost for ${provider}:`, error.message);
      return 0;
    }
  }

  /**
   * Track AI usage in database
   */
  async trackUsage(userId, provider, options = {}) {
    const {
      model,
      operation = 'image_generation',
      prompt = '',
      size,
      quality,
      steps,
      imagesGenerated = 1,
      success = true,
      errorMessage = null,
      responseMetadata = {}
    } = options;

    const estimatedCost = this.calculateEstimatedCost(provider, { size, quality, steps, model });
    
    // Calculate credits (1 credit = $0.01)
    const creditsUsed = estimatedCost * 100;

    try {
      const result = await db.query(`
        INSERT INTO ai_usage (
          user_id, provider, model, operation,
          credits_used, prompt_length, images_generated, image_size,
          estimated_cost, request_metadata, response_metadata,
          success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, credits_used, estimated_cost
      `, [
        userId,
        provider,
        model || 'default',
        operation,
        creditsUsed,
        prompt.length,
        imagesGenerated,
        size,
        estimatedCost,
        JSON.stringify({ size, quality, steps }),
        JSON.stringify(responseMetadata),
        success,
        errorMessage
      ]);

      // Update provider budget
      await this.updateProviderBudget(provider, creditsUsed, 1);

      logger.info(`AI usage tracked: ${provider} - ${creditsUsed.toFixed(2)} credits, $${estimatedCost.toFixed(4)}`);
      
      return {
        usageId: result.rows[0]?.id,
        creditsUsed,
        estimatedCost
      };
    } catch (error) {
      logger.error('Failed to track AI usage:', error.message);
      // Don't throw - tracking failure shouldn't break generation
      return { creditsUsed, estimatedCost };
    }
  }

  /**
   * Update provider budget counters
   */
  async updateProviderBudget(provider, creditsUsed, requestCount = 1) {
    try {
      await db.query(`
        INSERT INTO ai_provider_budgets (provider, current_credits_used, current_requests)
        VALUES ($1, $2, $3)
        ON CONFLICT (provider) DO UPDATE SET
          current_credits_used = ai_provider_budgets.current_credits_used + $2,
          current_requests = ai_provider_budgets.current_requests + $3,
          updated_at = NOW()
      `, [provider, creditsUsed, requestCount]);
    } catch (error) {
      logger.warn(`Failed to update provider budget for ${provider}:`, error.message);
    }
  }

  /**
   * Get usage statistics for a user
   */
  async getUserUsageStats(userId, period = 'month') {
    try {
      let dateFilter = '';
      if (period === 'month') {
        dateFilter = "AND created_at >= DATE_TRUNC('month', CURRENT_DATE)";
      } else if (period === 'week') {
        dateFilter = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'";
      } else if (period === 'day') {
        dateFilter = "AND created_at >= CURRENT_DATE";
      }

      const result = await db.query(`
        SELECT 
          provider,
          COUNT(*) as total_requests,
          SUM(credits_used) as total_credits,
          SUM(estimated_cost) as total_cost,
          SUM(images_generated) as total_images,
          COUNT(*) FILTER (WHERE success = true) as successful_requests,
          COUNT(*) FILTER (WHERE success = false) as failed_requests
        FROM ai_usage
        WHERE user_id = $1 ${dateFilter}
        GROUP BY provider
        ORDER BY total_credits DESC
      `, [userId]);

      // Get totals
      const totals = await db.query(`
        SELECT 
          COUNT(*) as total_requests,
          COALESCE(SUM(credits_used), 0) as total_credits,
          COALESCE(SUM(estimated_cost), 0) as total_cost,
          COALESCE(SUM(images_generated), 0) as total_images
        FROM ai_usage
        WHERE user_id = $1 ${dateFilter}
      `, [userId]);

      return {
        byProvider: result.rows,
        totals: totals.rows[0],
        period
      };
    } catch (error) {
      logger.error('Failed to get user usage stats:', error.message);
      return { byProvider: [], totals: { total_requests: 0, total_credits: 0, total_cost: 0, total_images: 0 }, period };
    }
  }

  /**
   * Get overall usage statistics (admin)
   */
  async getOverallUsageStats(period = 'month') {
    try {
      let dateFilter = '';
      if (period === 'month') {
        dateFilter = "WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)";
      } else if (period === 'week') {
        dateFilter = "WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'";
      }

      const byProvider = await db.query(`
        SELECT 
          provider,
          COUNT(*) as total_requests,
          SUM(credits_used) as total_credits,
          SUM(estimated_cost) as total_cost,
          SUM(images_generated) as total_images,
          COUNT(DISTINCT user_id) as unique_users
        FROM ai_usage
        ${dateFilter}
        GROUP BY provider
        ORDER BY total_credits DESC
      `);

      const budgets = await db.query(`
        SELECT 
          provider,
          monthly_credit_limit,
          monthly_request_limit,
          current_credits_used,
          current_requests,
          alert_threshold,
          is_active,
          ROUND((current_credits_used / NULLIF(monthly_credit_limit, 0) * 100)::numeric, 1) as credit_usage_percent,
          ROUND((current_requests::numeric / NULLIF(monthly_request_limit, 0) * 100)::numeric, 1) as request_usage_percent
        FROM ai_provider_budgets
        ORDER BY provider
      `);

      const totals = await db.query(`
        SELECT 
          COUNT(*) as total_requests,
          COALESCE(SUM(credits_used), 0) as total_credits,
          COALESCE(SUM(estimated_cost), 0) as total_cost,
          COALESCE(SUM(images_generated), 0) as total_images,
          COUNT(DISTINCT user_id) as unique_users
        FROM ai_usage
        ${dateFilter}
      `);

      return {
        byProvider: byProvider.rows,
        budgets: budgets.rows,
        totals: totals.rows[0],
        period
      };
    } catch (error) {
      logger.error('Failed to get overall usage stats:', error.message);
      return { byProvider: [], budgets: [], totals: {}, period };
    }
  }

  /**
   * Check if provider has budget remaining
   */
  async checkProviderBudget(provider) {
    try {
      const result = await db.query(`
        SELECT 
          monthly_credit_limit,
          monthly_request_limit,
          current_credits_used,
          current_requests,
          is_active
        FROM ai_provider_budgets
        WHERE provider = $1
      `, [provider]);

      if (result.rows.length === 0) {
        return { hasbudget: true, message: 'No budget configured' };
      }

      const budget = result.rows[0];
      
      if (!budget.is_active) {
        return { hasBudget: false, message: 'Provider is disabled' };
      }

      const creditRemaining = budget.monthly_credit_limit - budget.current_credits_used;
      const requestsRemaining = budget.monthly_request_limit - budget.current_requests;

      if (creditRemaining <= 0) {
        return { hasBudget: false, message: 'Monthly credit limit reached' };
      }

      if (requestsRemaining <= 0) {
        return { hasBudget: false, message: 'Monthly request limit reached' };
      }

      return {
        hasBudget: true,
        creditRemaining,
        requestsRemaining,
        creditUsagePercent: ((budget.current_credits_used / budget.monthly_credit_limit) * 100).toFixed(1)
      };
    } catch (error) {
      logger.warn(`Failed to check budget for ${provider}:`, error.message);
      return { hasBudget: true, message: 'Budget check failed' };
    }
  }

  /**
   * Reset monthly budgets (called by cron or manually)
   */
  async resetMonthlyBudgets() {
    try {
      await db.query(`
        UPDATE ai_provider_budgets
        SET 
          current_credits_used = 0,
          current_requests = 0,
          current_period_start = DATE_TRUNC('month', CURRENT_DATE),
          updated_at = NOW()
        WHERE current_period_start < DATE_TRUNC('month', CURRENT_DATE)
      `);
      logger.info('Monthly AI budgets reset');
    } catch (error) {
      logger.error('Failed to reset monthly budgets:', error.message);
    }
  }
}

module.exports = new AIService();
