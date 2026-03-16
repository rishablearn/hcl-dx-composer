/**
 * HCL DX API Proxy Routes
 * Securely proxy requests to HCL DX DAM and WCM APIs
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../config/logger');

const DX_HOST = process.env.HCL_DX_HOST;
const DX_PORT = process.env.HCL_DX_PORT || '443';
const DX_PROTOCOL = process.env.HCL_DX_PROTOCOL || 'https';
const DX_API_KEY = process.env.HCL_DX_API_KEY;
const DAM_BASE_URL = process.env.HCL_DX_DAM_BASE_URL;
const WCM_BASE_URL = process.env.HCL_DX_WCM_BASE_URL;

/**
 * Create proxy request configuration
 */
const createProxyConfig = (req, targetUrl) => {
  const headers = {
    'Accept': 'application/json',
    'Content-Type': req.headers['content-type'] || 'application/json'
  };

  // Pass through LTPA token if present
  if (req.cookies && req.cookies.LtpaToken2) {
    headers['Cookie'] = `LtpaToken2=${req.cookies.LtpaToken2}`;
  } else if (DX_API_KEY) {
    headers['Authorization'] = `Bearer ${DX_API_KEY}`;
  }

  return {
    method: req.method,
    url: targetUrl,
    headers,
    data: req.body,
    params: req.query,
    timeout: 30000,
    validateStatus: () => true
  };
};

// ===========================================================================
// DAM API Proxy
// ===========================================================================

/**
 * GET /api/dx/dam/*
 * Proxy GET requests to DAM API
 */
router.get('/dam/*', authenticateToken, async (req, res) => {
  try {
    const path = req.params[0];
    const targetUrl = `${DAM_BASE_URL}/${path}`;
    
    logger.debug(`Proxying DAM GET: ${targetUrl}`);
    
    const config = createProxyConfig(req, targetUrl);
    const response = await axios(config);
    
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('DAM proxy error:', error.message);
    res.status(500).json({ error: 'Failed to proxy DAM request' });
  }
});

/**
 * POST /api/dx/dam/*
 * Proxy POST requests to DAM API
 */
router.post('/dam/*', authenticateToken, async (req, res) => {
  try {
    const path = req.params[0];
    const targetUrl = `${DAM_BASE_URL}/${path}`;
    
    logger.debug(`Proxying DAM POST: ${targetUrl}`);
    
    const config = createProxyConfig(req, targetUrl);
    const response = await axios(config);
    
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('DAM proxy error:', error.message);
    res.status(500).json({ error: 'Failed to proxy DAM request' });
  }
});

/**
 * PUT /api/dx/dam/*
 * Proxy PUT requests to DAM API
 */
router.put('/dam/*', authenticateToken, async (req, res) => {
  try {
    const path = req.params[0];
    const targetUrl = `${DAM_BASE_URL}/${path}`;
    
    logger.debug(`Proxying DAM PUT: ${targetUrl}`);
    
    const config = createProxyConfig(req, targetUrl);
    const response = await axios(config);
    
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('DAM proxy error:', error.message);
    res.status(500).json({ error: 'Failed to proxy DAM request' });
  }
});

/**
 * DELETE /api/dx/dam/*
 * Proxy DELETE requests to DAM API
 */
router.delete('/dam/*', authenticateToken, async (req, res) => {
  try {
    const path = req.params[0];
    const targetUrl = `${DAM_BASE_URL}/${path}`;
    
    logger.debug(`Proxying DAM DELETE: ${targetUrl}`);
    
    const config = createProxyConfig(req, targetUrl);
    const response = await axios(config);
    
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('DAM proxy error:', error.message);
    res.status(500).json({ error: 'Failed to proxy DAM request' });
  }
});

// ===========================================================================
// WCM API Proxy
// ===========================================================================

/**
 * GET /api/dx/wcm/*
 * Proxy GET requests to WCM API
 */
router.get('/wcm/*', authenticateToken, async (req, res) => {
  try {
    const path = req.params[0];
    const targetUrl = `${WCM_BASE_URL}/${path}`;
    
    logger.debug(`Proxying WCM GET: ${targetUrl}`);
    
    const config = createProxyConfig(req, targetUrl);
    const response = await axios(config);
    
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('WCM proxy error:', error.message);
    res.status(500).json({ error: 'Failed to proxy WCM request' });
  }
});

/**
 * POST /api/dx/wcm/*
 * Proxy POST requests to WCM API
 */
router.post('/wcm/*', authenticateToken, async (req, res) => {
  try {
    const path = req.params[0];
    const targetUrl = `${WCM_BASE_URL}/${path}`;
    
    logger.debug(`Proxying WCM POST: ${targetUrl}`);
    
    const config = createProxyConfig(req, targetUrl);
    const response = await axios(config);
    
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('WCM proxy error:', error.message);
    res.status(500).json({ error: 'Failed to proxy WCM request' });
  }
});

/**
 * PUT /api/dx/wcm/*
 * Proxy PUT requests to WCM API
 */
router.put('/wcm/*', authenticateToken, async (req, res) => {
  try {
    const path = req.params[0];
    const targetUrl = `${WCM_BASE_URL}/${path}`;
    
    logger.debug(`Proxying WCM PUT: ${targetUrl}`);
    
    const config = createProxyConfig(req, targetUrl);
    const response = await axios(config);
    
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('WCM proxy error:', error.message);
    res.status(500).json({ error: 'Failed to proxy WCM request' });
  }
});

/**
 * DELETE /api/dx/wcm/*
 * Proxy DELETE requests to WCM API
 */
router.delete('/wcm/*', authenticateToken, async (req, res) => {
  try {
    const path = req.params[0];
    const targetUrl = `${WCM_BASE_URL}/${path}`;
    
    logger.debug(`Proxying WCM DELETE: ${targetUrl}`);
    
    const config = createProxyConfig(req, targetUrl);
    const response = await axios(config);
    
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('WCM proxy error:', error.message);
    res.status(500).json({ error: 'Failed to proxy WCM request' });
  }
});

// ===========================================================================
// Direct DX Portal Proxy (for SSO and other portal features)
// ===========================================================================

/**
 * GET /api/dx/portal/*
 * Proxy to DX Portal
 */
router.get('/portal/*', authenticateToken, async (req, res) => {
  try {
    const path = req.params[0];
    const targetUrl = `${DX_PROTOCOL}://${DX_HOST}:${DX_PORT}/wps/${path}`;
    
    logger.debug(`Proxying Portal GET: ${targetUrl}`);
    
    const config = createProxyConfig(req, targetUrl);
    const response = await axios(config);
    
    res.status(response.status).json(response.data);
  } catch (error) {
    logger.error('Portal proxy error:', error.message);
    res.status(500).json({ error: 'Failed to proxy portal request' });
  }
});

module.exports = router;
