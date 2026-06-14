import { logger } from '../utils/logger.js';

export default {
    name: 'ready',
    once: true,

    execute(client) {
        logger.info(`Bot online as ${client.user.tag}`, {
            userId: client.user.id,
            guilds: client.guilds.cache.size,
        });
    },
};
