const Redis = require('ioredis');

let connection = null;

const getRedisConnection = () => {
    if (!connection) {
        connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: null // Required by BullMQ
        });

        connection.on('error', (err) => {
            console.error('Redis connection error:', err.message);
        });

        connection.on('connect', () => {
            console.log('Redis connected');
        });
    }
    return connection;
};

const closeRedis = async () => {
    if (connection) {
        await connection.quit();
        connection = null;
    }
};

module.exports = { getRedisConnection, closeRedis };
