import express from 'express';
import { Configuration, OpenAIApi } from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const app = express();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.use(express.json());

app.get('/', (req, res) => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  res.sendFile(path.join(__dirname, 'index.html'));
});

function processResponse(response) {
  if (!response || response.trim() === '') {
    return [];
  }

  const segments = response.split(/\s(?=\(\w+\))/);
  const processedData = [];

  segments.forEach(segment => {
    const [prefix, content] = segment.split(') ');
    const language = prefix.replace('(', '');

    processedData.push({ language, content });
  });

  return processedData;
}

// Create a variable to store the conversation context
let conversationContext = [];

app.post('/message', async (req, res) => {
  if (!configuration.apiKey) {
    res.status(500).json({
      error: {
        message: 'OpenAI API key not configured, please follow instructions in README.md',
      },
    });
    return;
  }

  const prompt = `You are my Spanish teacher. We are practicing a conversation in Spanish.  Say everything in Spanish unless otherwise specified.`

  const userMessage = req.body.message || '';
  if (userMessage.trim().length === 0) {
    res.status(400).json({
      error: {
        message: 'Please enter a valid message',
      },
    });
    return;
  }

  try {
    // Add the conversation context to the prompt
    const initialPrompt = {role: "system", content: prompt}
    const initialMessage = {role: "system", content: "¡Hola! Estoy aquí para ayudarte con tu español. ¿Cómo estás?"}
    const inputMessage = {role: "user", content: userMessage}
    conversationContext.push(initialPrompt);
    conversationContext.push(initialMessage);
    conversationContext.push(inputMessage);

    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: conversationContext,
    });

    console.log("---- completion ----")
    console.log(completion.data.choices[0].message)
    console.log("---- end completion ----")
    const botResponse = completion.data.choices[0].message.content;
    const botMessage = {role: "system", content: botResponse}

    // Add the user message and bot response to the conversation context
    conversationContext.push(botMessage)

    res.status(200).json({
      message: botResponse,
      conversationContext: conversationContext,
    });
  } catch (error) {
    if (error.response) {
      console.error(error.response.status, error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`);
      res.status(500).json({
        error: {
          message: 'An error occurred during your request.',
        },
      });
    }
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
