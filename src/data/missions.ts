export const missions = [
  { id: 'llm', slug: 'how-llms-work', title: 'Как работают LLM', summary: 'Отличайте вероятное продолжение текста от проверенного факта.' },
  { id: 'hallucinations', slug: 'hallucinations', title: 'Галлюцинации', summary: 'Находите неподтверждённые утверждения и проверяйте источники.' },
  { id: 'structure', slug: 'prompt-structure', title: 'Структура эффективного промпта', summary: 'Собирайте понятный запрос: задача, контекст, ограничения и формат.' },
  { id: 'context', slug: 'role-context-constraints', title: 'Роль, контекст и ограничения', summary: 'Отбирайте полезные инструкции и задавайте проверяемый результат.' },
  { id: 'tokens', slug: 'tokens-context', title: 'Токены и лимиты контекста', summary: 'Укладывайте нужную информацию в ограниченный объём.' },
  { id: 'safety', slug: 'ai-safety', title: 'Безопасность при работе с AI', summary: 'Защищайте данные и отделяйте внешние материалы от инструкций.' },
] as const;
export type TopicId = (typeof missions)[number]['id'];
