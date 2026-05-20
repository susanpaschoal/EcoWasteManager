# ♻️ EcoWaste Manager

> Projeto baseado e inspirado no sistema original desenvolvido em linguagem C:
>
> ✨ Projeto original: 
> :contentReference[oaicite:0]{index=0}

Sistema web completo para gerenciamento de resíduos industriais desenvolvido com Node.js, Express e PostgreSQL (Neon Tech).

---

# 📌 Sobre o Projeto

O **EcoWaste Manager** surgiu como uma evolução do projeto original desenvolvido em C, expandindo a proposta para uma arquitetura web moderna e escalável.

A aplicação mantém o foco no gerenciamento sustentável de resíduos industriais, adicionando recursos modernos como:

- Interface web responsiva
- Banco de dados em nuvem
- Sistema de autenticação
- Controle de permissões
- Dashboard administrativo
- Sessões de usuários
- Estrutura pronta para deploy
- Integração com PostgreSQL Neon

---

# 🚀 Funcionalidades

## ✅ Gestão de Empresas

- Cadastro de empresas
- Razão social
- Nome fantasia
- CNPJ
- Endereço
- Responsável
- Contatos

---

## ✅ Gerenciamento de Resíduos

- Controle por regiões
- Registro de resíduos industriais
- Informações ambientais
- Monitoramento e relatórios

---

## ✅ Dashboard Administrativo

- Estatísticas em tempo real
- Indicadores do sistema
- Resumo operacional
- Controle administrativo

---

## ✅ Controle de Usuários

- Sistema de login
- Sessões autenticadas
- Controle de permissões
- Diferentes níveis de acesso

---

# 🔐 Usuário para Testes

O sistema possui um usuário administrador padrão para testes:

```txt
Usuário: admin
Senha: Admin@2024
```

---

# 👥 Tipos de Usuários

## 👨‍💼 Supervisor

Possui acesso completo:

- Dashboard
- Cadastro de empresas
- Relatórios
- Controle de resíduos
- Gerenciamento de usuários

---

## 👨‍🔧 Atendente

Possui acesso limitado:

- Consultas
- Registros básicos
- Operações operacionais

---

# 🗄️ Banco de Dados

O projeto utiliza:

## 🌐 Neon PostgreSQL

Banco de dados PostgreSQL em nuvem integrado ao Node.js.

Tabelas principais:

- `usuarios`
- `empresas`
- `gerenciamento_global`
- tabelas auxiliares

---

# 🚀 Tecnologias Utilizadas

| Tecnologia | Função |
|---|---|
| Node.js | Back-end |
| Express | Framework servidor |
| PostgreSQL | Banco de dados |
| Neon Tech | Banco em nuvem |
| HTML/CSS/JS | Interface |
| Bcrypt | Criptografia |
| Express Session | Autenticação |

---

# 📂 Estrutura do Projeto

```bash
EcoWasteManager/
│
├── public/
├── server.js
├── package.json
├── package-lock.json
├── .gitignore
├── .env
└── node_modules/
```

---

# ☁️ Deploy e Hospedagem

Projeto preparado para deploy online utilizando:

- Render
- Neon PostgreSQL

---

# 🔒 Segurança

O sistema utiliza:

- Senhas criptografadas com Bcrypt
- Sessões autenticadas
- Middleware de autenticação
- Controle de permissões
- Variáveis protegidas via `.env`

---

# 🧠 Aprendizados

Este projeto permitiu praticar:

- CRUD completo
- Node.js
- Express
- PostgreSQL
- Autenticação
- Sessões
- APIs
- Banco em nuvem
- Organização de sistemas completos

---

# 📸 Futuras Melhorias

- Responsividade mobile
- Exportação PDF
- Upload de arquivos
- Dashboard avançado
- Integração com IA
- Notificações
- Controle de estoque

---

# 👩‍💻 Desenvolvedora

Desenvolvido por **Susan Rodrigues Paschoal**.

📚 Projeto acadêmico e profissional voltado ao gerenciamento sustentável de resíduos industriais.

---

# ⭐ Apoie o Projeto

Se gostou do projeto:

- Deixe uma estrela ⭐
- Faça um fork
- Compartilhe
- Contribua com melhorias

---

# 📄 Licença

Este projeto está sob a licença ISC.
