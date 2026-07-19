import amqplib from 'amqplib'
import {config} from "./config.js"

const QUEUE = 'auth_notification_queue'

const connection = await amqplib.connect(config.RABBITMQ_URL)

const channel  = await connection.createChannel()

channel.assertQueue(QUEUE,{durable:true})

export async function sendAuthNotification(message) {
    
    channel.sendToQueue(
        QUEUE,
        Buffer.from(JSON.stringify(message)),
        {persistent:true}
    )
}