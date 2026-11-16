// Ambiente de teste: sempre modo demonstração, sem persistência em disco e sem IA externa.
process.env.DATA_BACKEND = 'demo'
process.env.AI_PROVIDER = 'local'
process.env.AI_EXTERNAL_ALLOWED = 'false'
delete process.env.DEMO_PERSIST_FILE
