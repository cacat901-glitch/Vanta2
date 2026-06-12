import { OpenAICompatibleProvider } from './OpenAICompatibleProvider'

export class GroqProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string, model = 'llama-3.3-70b-versatile') {
    super('groq', 'Groq', 'https://api.groq.com/openai/v1', model, apiKey)
  }
}
