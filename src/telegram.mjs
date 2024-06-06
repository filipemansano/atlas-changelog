import axios from "axios";

const botToken = process.env.TELEGRAM_TOKEN;
const chatId = process.env.CHAT_ID;

const dateOptions = { day: '2-digit', month: 'long', year: 'numeric' };

export const sendMessage = async (productName, date, change) => {

    const message = `*${productName.toUpperCase()}*\n-- ${date.toLocaleDateString('en-GB', dateOptions)} --\n${change.replace(/\t+/g, '  • ')}\n`;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    await axios.post(url, {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
    });
};