# AI Image Generation Providers Guide

This document provides comprehensive information on configuring and using AI image generation providers with HCL DX Composer.

## Overview

HCL DX Composer supports multiple AI image generation providers, including **free tier options** for cost-effective image generation.

| Provider | Free Tier | Quality | Speed | Best For |
|----------|-----------|---------|-------|----------|
| **Google Gemini** | ✅ 500/day | High | Fast | General purpose, recommended |
| **Hugging Face** | ✅ Limited | Variable | Medium | Open-source models, customization |
| **OpenAI DALL-E** | ❌ Paid | Excellent | Fast | Photorealistic, professional |
| **Stability AI** | ❌ Paid | Excellent | Medium | Artistic, fine control |

---

## Google Gemini (Recommended - FREE)

Google's Gemini models offer excellent image generation with a generous free tier.

### Free Tier Limits

- **500 images per day** (free tier)
- No credit card required
- Models: `gemini-2.5-flash-image`, `gemini-3.1-flash-image-preview`

### Setup

1. Get API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Configure in `.env`:

```env
AI_IMAGE_PROVIDER=gemini
GOOGLE_AI_API_KEY=your_api_key_here
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
```

### API Usage Example

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

async function generateImage(prompt) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
  });
  
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const imageData = part.inlineData.data;
      return Buffer.from(imageData, "base64");
    }
  }
}
```

### Available Models

| Model | Resolution | Best For |
|-------|------------|----------|
| `gemini-2.5-flash-image` | 1024px | Fast, high-volume |
| `gemini-3.1-flash-image-preview` | 1024px | Better quality |
| `gemini-3-pro-image-preview` | Up to 4K | Professional, complex |

---

## Hugging Face (FREE)

Access open-source models like FLUX.1 and Stable Diffusion via Hugging Face's Inference API.

### Free Tier Limits

- Limited requests per month (varies by model)
- Some models require Pro subscription
- Rate limited during high traffic

### Setup

1. Create account at [Hugging Face](https://huggingface.co)
2. Get API token from [Settings > Tokens](https://huggingface.co/settings/tokens)
3. Configure in `.env`:

```env
AI_IMAGE_PROVIDER=huggingface
HUGGINGFACE_API_KEY=hf_your_token_here
HUGGINGFACE_MODEL=black-forest-labs/FLUX.1-schnell
```

### API Usage Example

```javascript
async function generateImage(prompt) {
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${process.env.HUGGINGFACE_MODEL}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: prompt }),
    }
  );
  
  const imageBlob = await response.blob();
  return Buffer.from(await imageBlob.arrayBuffer());
}
```

### Available Models (Free Tier)

| Model | Type | Notes |
|-------|------|-------|
| `black-forest-labs/FLUX.1-schnell` | FLUX | Fast, Apache 2.0 license |
| `stabilityai/stable-diffusion-xl-base-1.0` | SDXL | High quality |
| `runwayml/stable-diffusion-v1-5` | SD 1.5 | Classic, widely supported |
| `CompVis/stable-diffusion-v1-4` | SD 1.4 | Lightweight |

### Pro Models (Require Subscription)

| Model | Type | Notes |
|-------|------|-------|
| `black-forest-labs/FLUX.1-dev` | FLUX | Development version |
| `stabilityai/stable-diffusion-3-medium` | SD3 | Latest architecture |

---

## OpenAI DALL-E (Paid)

Premium image generation with excellent quality and reliability.

### Pricing

| Model | Resolution | Price |
|-------|------------|-------|
| DALL-E 3 | 1024×1024 | $0.040 |
| DALL-E 3 | 1024×1792 | $0.080 |
| DALL-E 3 HD | 1024×1024 | $0.080 |
| DALL-E 3 HD | 1024×1792 | $0.120 |

### Setup

1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add billing/credits to your account
3. Configure in `.env`:

```env
AI_IMAGE_PROVIDER=openai
OPENAI_API_KEY=sk-your_api_key_here
```

### API Usage Example

```javascript
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateImage(prompt) {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
  });
  
  return response.data[0].url;
}
```

---

## Stability AI (Paid)

Fine artistic control with Stable Diffusion models.

### Pricing

- Credit-based system
- ~$0.002-0.006 per image depending on model and settings
- Bulk credits available

### Setup

1. Get API key from [Stability Platform](https://platform.stability.ai/account/keys)
2. Purchase credits
3. Configure in `.env`:

```env
AI_IMAGE_PROVIDER=stability
STABILITY_API_KEY=sk-your_api_key_here
```

### API Usage Example

```javascript
async function generateImage(prompt) {
  const response = await fetch(
    "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.STABILITY_API_KEY}`,
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt, weight: 1 }],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        samples: 1,
        steps: 30,
      }),
    }
  );
  
  const data = await response.json();
  return Buffer.from(data.artifacts[0].base64, "base64");
}
```

### Available Models

| Model | Resolution | Notes |
|-------|------------|-------|
| `stable-diffusion-xl-1024-v1-0` | 1024px | SDXL base |
| `stable-diffusion-v1-6` | 512px | Fast, lightweight |
| `stable-diffusion-3` | 1024px | Latest (requires access) |

---

## Comparison Summary

### Free Options

```
┌─────────────────────────────────────────────────────────────────┐
│                    FREE AI IMAGE GENERATION                      │
├─────────────────┬───────────────────────────────────────────────┤
│ Google Gemini   │ ★★★★★ Best free option                        │
│                 │ • 500 images/day                              │
│                 │ • High quality                                │
│                 │ • Fast response                               │
│                 │ • Easy setup                                  │
├─────────────────┼───────────────────────────────────────────────┤
│ Hugging Face    │ ★★★☆☆ Good for customization                  │
│                 │ • Limited free requests                       │
│                 │ • Open-source models                          │
│                 │ • Rate limited                                │
│                 │ • Model variety                               │
└─────────────────┴───────────────────────────────────────────────┘
```

### Paid Options

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAID AI IMAGE GENERATION                      │
├─────────────────┬───────────────────────────────────────────────┤
│ OpenAI DALL-E   │ ★★★★★ Premium quality                         │
│                 │ • $0.04-0.12 per image                        │
│                 │ • Photorealistic                              │
│                 │ • Fast & reliable                             │
│                 │ • Best prompt understanding                   │
├─────────────────┼───────────────────────────────────────────────┤
│ Stability AI    │ ★★★★☆ Fine artistic control                   │
│                 │ • Credit-based pricing                        │
│                 │ • Artistic styles                             │
│                 │ • Negative prompts                            │
│                 │ • Many parameters                             │
└─────────────────┴───────────────────────────────────────────────┘
```

---

## Quick Configuration

### For Free Tier (Recommended)

```env
# Use Google Gemini - 500 free images/day
AI_IMAGE_PROVIDER=gemini
GOOGLE_AI_API_KEY=your_key_from_aistudio.google.com
```

### For Maximum Quality (Paid)

```env
# Use OpenAI DALL-E 3
AI_IMAGE_PROVIDER=openai
OPENAI_API_KEY=sk-your_openai_key
```

### For Open Source

```env
# Use Hugging Face with FLUX
AI_IMAGE_PROVIDER=huggingface
HUGGINGFACE_API_KEY=hf_your_token
HUGGINGFACE_MODEL=black-forest-labs/FLUX.1-schnell
```

---

## Troubleshooting

### Google Gemini Issues

| Error | Solution |
|-------|----------|
| `API key not valid` | Regenerate key at AI Studio |
| `Quota exceeded` | Wait 24 hours or upgrade |
| `Safety filter blocked` | Modify prompt to be less controversial |

### Hugging Face Issues

| Error | Solution |
|-------|----------|
| `Model loading` | Wait 20-60 seconds, retry |
| `Rate limit` | Reduce request frequency |
| `Unauthorized` | Check token has `read` scope |

### OpenAI Issues

| Error | Solution |
|-------|----------|
| `Insufficient quota` | Add billing credits |
| `Content policy violation` | Modify prompt content |
| `Rate limit` | Implement exponential backoff |

### Stability AI Issues

| Error | Solution |
|-------|----------|
| `Invalid API key` | Check key at platform.stability.ai |
| `Insufficient credits` | Purchase more credits |
| `Model unavailable` | Try different model |

---

## References

- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Hugging Face Inference API](https://huggingface.co/docs/api-inference)
- [OpenAI DALL-E API](https://platform.openai.com/docs/guides/images)
- [Stability AI API](https://platform.stability.ai/docs/api-reference)

---

*Document Version: 1.0*
*Last Updated: March 2026*
