import amqplib from 'amqplib'
import {config} from "./config.js"

const QUEUE = 'auth_notification_queue'

let channel = null

async function connect(retries = 10, delayMs = 3000) {
    for (let i = 1; i <= retries; i++) {
        try {
            const connection = await amqplib.connect(config.RABBITMQ_URL)
            const ch = await connection.createChannel()
            await ch.assertQueue(QUEUE, { durable: true })

            connection.on('error', (err) => {
                console.error('[MQ] Connection error:', err.message)
                channel = null
            })
            connection.on('close', () => {
                console.warn('[MQ] Connection closed — will reconnect on next message')
                channel = null
            })

            channel = ch
            console.log('[MQ] Connected to RabbitMQ')
            return
        } catch (err) {
            console.warn(`[MQ] Connection attempt ${i}/${retries} failed: ${err.message}`)
            if (i < retries) await new Promise(r => setTimeout(r, delayMs * i))
        }
    }
    console.error('[MQ] Could not connect to RabbitMQ after all retries — messages will be dropped')
}

// Initiate connection in the background; don't block module load
connect()

export async function sendAuthNotification(message) {
    if (!channel) {
        // Lazy reconnect attempt before giving up
        await connect(3, 1000)
    }
    if (!channel) {
        console.error('[MQ] No channel available — dropping notification:', message)
        return
    }
    channel.sendToQueue(
        QUEUE,
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
    )
}