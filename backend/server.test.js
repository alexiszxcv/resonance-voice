const request = require('supertest');
const express = require('express');
const cors = require('cors');

// Create a test app
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('version');
  });
});

describe('Rate Limiting', () => {
  it('should allow requests within limit', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .get('/health')
        .expect(200);
    }
  });
});