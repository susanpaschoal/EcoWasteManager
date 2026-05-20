// ============================================================
//  EcoWaste Manager — server.js
//  Node.js + Express + Neon PostgreSQL
//  Sistema de Gerenciamento de Resíduos Industriais
// ============================================================

require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const bcrypt       = require('bcrypt');
const { Pool }     = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database ─────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'ecowaste-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 }
}));

// ── Auth Middlewares ──────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/');
  next();
}
function requireSupervisor(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'supervisor')
    return res.status(403).json({ error: 'Acesso negado. Apenas supervisores.' });
  next();
}

// ── DB Init ───────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nome VARCHAR(100),
      role VARCHAR(20) DEFAULT 'atendente',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS empresas (
      id SERIAL PRIMARY KEY,
      nome_empresa VARCHAR(200),
      cnpj VARCHAR(20),
      razao_social VARCHAR(200),
      nome_fantasia VARCHAR(200),
      email VARCHAR(150),
      data_abertura DATE,
      endereco TEXT,
      telefone VARCHAR(20),
      nome_responsavel VARCHAR(150),
      data_nascimento DATE,
      cpf_responsavel VARCHAR(15),
      email_responsavel VARCHAR(150),
      contato_responsavel VARCHAR(20),
      ativo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gerenciamento_global (
      id SERIAL PRIMARY KEY,
      regiao VARCHAR(200),
      industrias_menor_prod TEXT,
      aporte_financeiro VARCHAR(100),
      semestre VARCHAR(10),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS gerenciamento_empresa (
      id SERIAL PRIMARY KEY,
      empresa_id INT REFERENCES empresas(id) ON DELETE CASCADE,
      nome_empresa VARCHAR(200),
      data_atualizacao DATE,
      quantidade_residuos NUMERIC(15,2),
      quantidade_tratados NUMERIC(15,2),
      percentual_tratado NUMERIC(5,2),
      custo_total NUMERIC(15,2),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Seed admin
  const exists = await pool.query(`SELECT id FROM usuarios WHERE username = 'admin'`);
  if (exists.rows.length === 0) {
    const hash = await bcrypt.hash('Admin@2024', 10);
    await pool.query(
      `INSERT INTO usuarios (username, password_hash, nome, role) VALUES ($1, $2, $3, $4)`,
      ['admin', hash, 'Administrador', 'supervisor']
    );
    console.log('✅ Usuário admin criado — login: admin / Admin@2024');
  }
  console.log('✅ Banco de dados inicializado.');
}

// ════════════════════════════════════════════════════════════════
//  SHARED CSS + JS TEMPLATE
// ════════════════════════════════════════════════════════════════
const sharedCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #0f1117;
    --bg2:       #161b27;
    --bg3:       #1e2535;
    --border:    #2a3448;
    --green:     #22c55e;
    --green2:    #16a34a;
    --green-dim: rgba(34,197,94,.12);
    --text:      #e2e8f0;
    --text2:     #94a3b8;
    --text3:     #64748b;
    --red:       #ef4444;
    --amber:     #f59e0b;
    --blue:      #3b82f6;
    --radius:    12px;
    --shadow:    0 4px 24px rgba(0,0,0,.35);
  }

  html, body { height: 100%; font-family: 'Sora', sans-serif; background: var(--bg); color: var(--text); font-size: 15px; }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 99px; }

  /* ── Layout ── */
  .app { display: flex; min-height: 100vh; }

  /* ── Sidebar ── */
  .sidebar {
    width: 240px; background: var(--bg2); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; transition: width .3s;
    position: fixed; top: 0; left: 0; height: 100vh; z-index: 100; overflow: hidden;
  }
  .sidebar.collapsed { width: 64px; }
  .sidebar-logo {
    display: flex; align-items: center; gap: 12px; padding: 20px 16px;
    border-bottom: 1px solid var(--border); min-height: 64px;
  }
  .sidebar-logo svg { flex-shrink: 0; }
  .sidebar-logo-text { font-size: 15px; font-weight: 700; color: var(--green); white-space: nowrap; overflow: hidden; transition: opacity .2s; }
  .sidebar.collapsed .sidebar-logo-text { opacity: 0; }
  .sidebar-toggle {
    margin: 0 8px 0 auto; background: none; border: none; cursor: pointer;
    color: var(--text2); padding: 4px; border-radius: 6px; display: flex;
    transition: color .2s, background .2s;
  }
  .sidebar-toggle:hover { background: var(--bg3); color: var(--text); }

  .nav { flex: 1; padding: 12px 8px; overflow-y: auto; }
  .nav-section { font-size: 10px; font-weight: 600; color: var(--text3); letter-spacing: .1em; text-transform: uppercase; padding: 8px 8px 4px; white-space: nowrap; overflow: hidden; transition: opacity .2s; }
  .sidebar.collapsed .nav-section { opacity: 0; }
  .nav-item {
    display: flex; align-items: center; gap: 12px; padding: 9px 12px;
    border-radius: 8px; cursor: pointer; color: var(--text2); text-decoration: none;
    transition: background .15s, color .15s; white-space: nowrap; overflow: hidden;
    font-size: 14px; font-weight: 500; border: none; background: none; width: 100%;
  }
  .nav-item svg { flex-shrink: 0; }
  .nav-item span { overflow: hidden; transition: opacity .2s; }
  .sidebar.collapsed .nav-item span { opacity: 0; }
  .nav-item:hover, .nav-item.active { background: var(--green-dim); color: var(--green); }
  .nav-item.active { color: var(--green); }

  .sidebar-footer { padding: 12px 8px; border-top: 1px solid var(--border); }

  /* ── Main ── */
  .main { flex: 1; margin-left: 240px; transition: margin-left .3s; display: flex; flex-direction: column; }
  .main.expanded { margin-left: 64px; }

  /* ── Topbar ── */
  .topbar {
    height: 64px; background: var(--bg2); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; padding: 0 24px; gap: 16px; position: sticky; top: 0; z-index: 50;
  }
  .topbar-title { font-size: 18px; font-weight: 600; }
  .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
  .user-chip {
    display: flex; align-items: center; gap: 8px; padding: 6px 12px;
    background: var(--bg3); border: 1px solid var(--border); border-radius: 99px; font-size: 13px;
  }
  .user-chip .role { color: var(--green); font-size: 11px; background: var(--green-dim); padding: 1px 8px; border-radius: 99px; }

  /* ── Content ── */
  .content { padding: 24px; flex: 1; }

  /* ── Cards ── */
  .card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
  .card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .card-header h2 { font-size: 16px; font-weight: 600; }
  .card-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .ci-green  { background: var(--green-dim); color: var(--green); }
  .ci-blue   { background: rgba(59,130,246,.12); color: var(--blue); }
  .ci-amber  { background: rgba(245,158,11,.12); color: var(--amber); }
  .ci-red    { background: rgba(239,68,68,.12); color: var(--red); }

  .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .stat-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
  .stat-label { font-size: 12px; color: var(--text2); margin-bottom: 8px; font-weight: 500; text-transform: uppercase; letter-spacing: .05em; }
  .stat-value { font-size: 28px; font-weight: 700; line-height: 1; }
  .stat-sub { font-size: 12px; color: var(--text3); margin-top: 6px; }
  .stat-green { color: var(--green); }
  .stat-blue  { color: var(--blue); }
  .stat-amber { color: var(--amber); }

  /* ── Grid ── */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 800px) { .grid-2 { grid-template-columns: 1fr; } }

  /* ── Forms ── */
  .form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group label { font-size: 12px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: .05em; }
  .form-group input, .form-group select, .form-group textarea {
    background: var(--bg3); border: 1px solid var(--border); border-radius: 8px;
    color: var(--text); padding: 9px 12px; font-size: 14px; font-family: 'Sora', sans-serif;
    outline: none; transition: border-color .2s, box-shadow .2s;
  }
  .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
    border-color: var(--green); box-shadow: 0 0 0 3px rgba(34,197,94,.15);
  }
  .form-group select option { background: var(--bg3); }
  .form-group textarea { resize: vertical; min-height: 80px; }
  .form-full { grid-column: 1 / -1; }

  /* ── Buttons ── */
  .btn {
    display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px;
    border-radius: 8px; font-size: 14px; font-weight: 600; font-family: 'Sora', sans-serif;
    cursor: pointer; border: none; transition: all .15s;
  }
  .btn-primary { background: var(--green); color: #000; }
  .btn-primary:hover { background: var(--green2); }
  .btn-secondary { background: var(--bg3); color: var(--text); border: 1px solid var(--border); }
  .btn-secondary:hover { background: var(--border); }
  .btn-danger { background: rgba(239,68,68,.15); color: var(--red); border: 1px solid rgba(239,68,68,.3); }
  .btn-danger:hover { background: rgba(239,68,68,.25); }
  .btn-sm { padding: 5px 10px; font-size: 12px; gap: 5px; }
  .btn-icon { padding: 6px; border-radius: 6px; }

  /* ── Tables ── */
  .table-wrap { overflow-x: auto; border-radius: var(--radius); border: 1px solid var(--border); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th { background: var(--bg3); padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: .05em; white-space: nowrap; }
  tbody td { padding: 11px 14px; border-top: 1px solid var(--border); color: var(--text); vertical-align: middle; }
  tbody tr { transition: background .1s; }
  tbody tr:hover { background: var(--bg3); }
  .badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; }
  .badge-green { background: var(--green-dim); color: var(--green); }
  .badge-red   { background: rgba(239,68,68,.12); color: var(--red); }
  .badge-amber { background: rgba(245,158,11,.12); color: var(--amber); }
  .badge-blue  { background: rgba(59,130,246,.12); color: var(--blue); }

  /* ── Modal ── */
  .modal-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,.6);
    z-index: 200; align-items: center; justify-content: center; backdrop-filter: blur(4px);
  }
  .modal-overlay.open { display: flex; }
  .modal {
    background: var(--bg2); border: 1px solid var(--border); border-radius: 16px;
    width: min(640px, calc(100vw - 32px)); max-height: 85vh; overflow-y: auto;
    box-shadow: var(--shadow); animation: slide-up .2s ease;
  }
  @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .modal-header { padding: 20px 24px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .modal-header h3 { font-size: 16px; font-weight: 600; }
  .modal-body { padding: 20px 24px; }
  .modal-footer { padding: 16px 24px; border-top: 1px solid var(--border); display: flex; gap: 10px; justify-content: flex-end; }
  .close-btn { background: none; border: none; color: var(--text2); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; }
  .close-btn:hover { background: var(--bg3); color: var(--text); }

  /* ── Toast ── */
  #toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 999; display: flex; flex-direction: column; gap: 8px; }
  .toast {
    display: flex; align-items: center; gap: 10px; padding: 12px 16px;
    background: var(--bg2); border: 1px solid var(--border); border-radius: 10px;
    box-shadow: var(--shadow); font-size: 13px; font-weight: 500; min-width: 240px;
    animation: toast-in .25s ease;
  }
  @keyframes toast-in { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  .toast.success { border-left: 3px solid var(--green); }
  .toast.error   { border-left: 3px solid var(--red); }
  .toast.info    { border-left: 3px solid var(--blue); }

  /* ── Search ── */
  .search-bar { display: flex; align-items: center; gap: 8px; background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 0 12px; transition: border-color .2s; }
  .search-bar:focus-within { border-color: var(--green); }
  .search-bar input { background: none; border: none; color: var(--text); font-family: 'Sora', sans-serif; font-size: 14px; padding: 9px 0; outline: none; flex: 1; }

  /* ── Pagination ── */
  .pagination { display: flex; gap: 4px; align-items: center; margin-top: 16px; }
  .page-btn { padding: 5px 10px; background: var(--bg3); border: 1px solid var(--border); border-radius: 6px; color: var(--text2); cursor: pointer; font-size: 13px; transition: all .15s; }
  .page-btn:hover, .page-btn.active { background: var(--green-dim); color: var(--green); border-color: var(--green); }

  /* ── Misc ── */
  .page { display: none; }
  .page.active { display: block; }
  .section-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: gap; gap: 12px; }
  .section-top h1 { font-size: 20px; font-weight: 700; }
  .divider { height: 1px; background: var(--border); margin: 20px 0; }
  .chart-container { position: relative; height: 220px; }
  .mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
  .text-green { color: var(--green); }
  .text-red   { color: var(--red); }
  .text-amber { color: var(--amber); }
  .text-muted { color: var(--text2); }
  .mt-4 { margin-top: 16px; }
  .mb-4 { margin-bottom: 16px; }
  .flex { display: flex; }
  .gap-2 { gap: 8px; }
  .items-center { align-items: center; }
  .spinner { width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--green); border-radius: 50%; animation: spin .6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Mobile hamburger button ── */
  .mobile-menu-btn {
    display: none; position: fixed; top: 14px; left: 14px; z-index: 150;
    background: var(--bg2); border: 1px solid var(--border); border-radius: 8px;
    padding: 8px; cursor: pointer; color: var(--text2); transition: all .2s;
  }
  .mobile-menu-btn:hover { color: var(--green); background: var(--green-dim); }

  /* ── Mobile sidebar overlay ── */
  .sidebar-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,.6);
    z-index: 99; backdrop-filter: blur(2px);
  }
  .sidebar-overlay.open { display: block; }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    /* Sidebar */
    .mobile-menu-btn { display: flex; }
    .sidebar {
      width: 240px; transform: translateX(-100%); transition: transform .3s;
      z-index: 100;
    }
    .sidebar.mobile-open { transform: translateX(0); }
    .sidebar.collapsed { width: 240px; }
    .sidebar.collapsed .sidebar-logo-text,
    .sidebar.collapsed .nav-item span,
    .sidebar.collapsed .nav-section { opacity: 1; }

    /* Layout */
    .main { margin-left: 0 !important; }
    .topbar { padding-left: 56px; height: 56px; }
    .topbar-title { font-size: 15px; }
    .user-chip { padding: 5px 10px; }
    .user-chip span.role { display: none; }
    .content { padding: 12px; }

    /* Dashboard stats: 2 colunas no mobile */
    .stat-grid { grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    .stat-card { padding: 14px; }
    .stat-value { font-size: 22px; }
    .stat-label { font-size: 11px; }

    /* Grids */
    .grid-2 { grid-template-columns: 1fr; gap: 12px; }

    /* Charts menores no mobile */
    .chart-container { height: 180px; }

    /* Cards */
    .card { padding: 14px; }
    .card-header { margin-bottom: 12px; }
    .card-header h2 { font-size: 14px; }

    /* Section top: empilha título e botões */
    .section-top {
      flex-direction: column; align-items: flex-start; gap: 10px; margin-bottom: 14px;
    }
    .section-top h1 { font-size: 18px; }
    .section-top .flex { width: 100%; flex-wrap: wrap; }
    .section-top .search-bar { width: 100%; }
    .section-top .search-bar input { width: 100%; }

    /* Formulários: 1 coluna no mobile */
    .form-grid { grid-template-columns: 1fr; gap: 12px; }
    .form-full { grid-column: 1; }
    .form-group input, .form-group select, .form-group textarea {
      font-size: 16px; /* evita zoom no iOS */
      padding: 10px 12px;
    }

    /* Botões: largura total em contextos de form */
    .card > .btn, .card > .flex > .btn { width: 100%; justify-content: center; }
    .flex.gap-2 > .btn-primary { flex: 1; justify-content: center; }

    /* Tabelas: scroll horizontal, fonte menor */
    .table-wrap { border-radius: 8px; }
    table { font-size: 12px; }
    thead th { padding: 9px 10px; font-size: 10px; }
    tbody td { padding: 9px 10px; }

    /* Esconde colunas menos importantes no mobile */
    .hide-mobile { display: none !important; }

    /* Modal */
    .modal {
      width: 100vw; max-height: 92vh; border-radius: 16px 16px 0 0;
      position: fixed; bottom: 0; left: 0; right: 0; animation: slide-up-mobile .2s ease;
    }
    .modal-overlay { align-items: flex-end; }
    @keyframes slide-up-mobile { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .modal-header { padding: 16px 18px 12px; }
    .modal-body { padding: 14px 18px; }
    .modal-footer { padding: 12px 18px; }

    /* Toast: bottom full width no mobile */
    #toast-container { bottom: 16px; right: 12px; left: 12px; }
    .toast { min-width: unset; width: 100%; }

    /* Pagination: menor */
    .pagination { flex-wrap: wrap; gap: 4px; margin-top: 12px; }
    .page-btn { padding: 5px 9px; font-size: 12px; }

    /* Margens e espaçamentos menores */
    .mb-4 { margin-bottom: 12px; }
    .mt-4 { margin-top: 12px; }
    .divider { margin: 14px 0; }

    /* Relatórios: botões de export empilhados */
    #page-relatorios .section-top .flex { gap: 6px; }
    #page-relatorios .btn-sm { flex: 1; justify-content: center; }

    /* Config: senhas e funcionários */
    #page-config .grid-2 { grid-template-columns: 1fr; }

    /* Gerenciamento por empresa */
    #page-empresa .form-grid { grid-template-columns: 1fr 1fr; }
    #page-empresa .form-grid .form-group:first-child { grid-column: 1 / -1; }
  }

  /* Telas muito pequenas (< 400px) */
  @media (max-width: 400px) {
    .stat-grid { grid-template-columns: 1fr; }
    .stat-value { font-size: 26px; }
    #page-empresa .form-grid { grid-template-columns: 1fr; }
  }
`;

const sharedJS = `
  // ── Toast ─────────────────────────────────────────────────────
  function toast(msg, type='success') {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    el.innerHTML = '<span>' + (icons[type]||'') + '</span><span>' + msg + '</span>';
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ── Sidebar toggle ────────────────────────────────────────────
  function initSidebar() {
    const sb = document.getElementById('sidebar');
    const main = document.getElementById('main');
    const btn = document.getElementById('sidebar-toggle');
    if (btn && sb) {
      btn.addEventListener('click', () => {
        sb.classList.toggle('collapsed');
        main.classList.toggle('expanded');
      });
    }
  }

  function toggleMobileSidebar() {
    const sb = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sb.classList.toggle('mobile-open');
    overlay.classList.toggle('open');
  }

  function closeMobileSidebar() {
    const sb = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sb.classList.remove('mobile-open');
    overlay.classList.remove('open');
  }

  // ── Nav ───────────────────────────────────────────────────────
  function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const pg = document.getElementById('page-' + page);
    if (pg) pg.classList.add('active');
    const nav = document.querySelector('[data-page="' + page + '"]');
    if (nav) nav.classList.add('active');
    // Close mobile sidebar on navigation
    closeMobileSidebar();
    document.querySelector('.topbar-title').textContent = {
      dashboard: 'Dashboard',
      empresas: 'Empresas',
      cadastrar: 'Cadastrar Empresa',
      global: 'Gerenciamento Global',
      empresa: 'Gerenciamento por Empresa',
      relatorios: 'Relatórios',
      config: 'Configurações'
    }[page] || page;
  }

  // ── Modal helpers ─────────────────────────────────────────────
  function openModal(id) { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
  });

  // ── API helper ────────────────────────────────────────────────
  async function api(url, opts={}) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
    return res.json();
  }

  // ── CPF / CNPJ masks ──────────────────────────────────────────
  function maskCPF(v) {
    return v.replace(/\\D/g,'').replace(/(\\d{3})(\\d{3})(\\d{3})(\\d{2})/,'$1.$2.$3-$4').slice(0,14);
  }
  function maskCNPJ(v) {
    return v.replace(/\\D/g,'').replace(/(\\d{2})(\\d{3})(\\d{3})(\\d{4})(\\d{2})/,'$1.$2.$3/$4-$5').slice(0,18);
  }
  function maskPhone(v) {
    return v.replace(/\\D/g,'').replace(/(\\d{2})(\\d{5})(\\d{4})/,'($1) $2-$3').slice(0,15);
  }
  function applyMasks() {
    document.querySelectorAll('[data-mask="cpf"]').forEach(el => {
      el.addEventListener('input', () => { el.value = maskCPF(el.value); });
    });
    document.querySelectorAll('[data-mask="cnpj"]').forEach(el => {
      el.addEventListener('input', () => { el.value = maskCNPJ(el.value); });
    });
    document.querySelectorAll('[data-mask="phone"]').forEach(el => {
      el.addEventListener('input', () => { el.value = maskPhone(el.value); });
    });
  }

  // ── Pagination helper ─────────────────────────────────────────
  let currentPage = 1;
  const pageSize  = 10;

  // ── CSV Export ────────────────────────────────────────────────
  function exportCSV(data, filename) {
    if (!data.length) return toast('Sem dados para exportar', 'info');
    const keys = Object.keys(data[0]);
    const rows = [keys.join(';'), ...data.map(r => keys.map(k => '"' + (r[k]||'') + '"').join(';'))];
    const blob = new Blob([rows.join('\\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = filename; a.click();
  }
  function exportTXT(data, filename) {
    if (!data.length) return toast('Sem dados para exportar', 'info');
    const lines = data.map(r => Object.entries(r).map(([k,v]) => k+': '+v).join('\\n')).join('\\n---\\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = filename; a.click();
  }
`;

// ════════════════════════════════════════════════════════════════
//  LOGIN PAGE
// ════════════════════════════════════════════════════════════════
function loginPage() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>EcoWaste Manager — Login</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{--green:#22c55e;--green2:#16a34a;--bg:#0f1117;--bg2:#161b27;--bg3:#1e2535;--border:#2a3448;--text:#e2e8f0;--text2:#94a3b8;}
  html,body{height:100%;font-family:'Sora',sans-serif;background:var(--bg);color:var(--text)}
  body{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
  .bg-grid{position:fixed;inset:0;background-image:linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px);background-size:40px 40px;opacity:.25;pointer-events:none}
  .glow{position:fixed;width:500px;height:500px;background:radial-gradient(circle,rgba(34,197,94,.12) 0%,transparent 70%);top:-100px;left:50%;transform:translateX(-50%);pointer-events:none}
  .card{background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:40px;width:min(420px,100%);position:relative;box-shadow:0 24px 64px rgba(0,0,0,.4)}
  .logo{display:flex;align-items:center;gap:12px;margin-bottom:32px}
  .logo-icon{width:44px;height:44px;background:var(--green);border-radius:12px;display:flex;align-items:center;justify-content:center}
  .logo-text{font-size:20px;font-weight:700}
  .logo-sub{font-size:12px;color:var(--text2);margin-top:2px}
  h1{font-size:22px;font-weight:700;margin-bottom:6px}
  p{font-size:14px;color:var(--text2);margin-bottom:28px}
  .field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
  label{font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.05em}
  input{background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--text);padding:11px 14px;font-size:14px;font-family:'Sora',sans-serif;outline:none;transition:border-color .2s,box-shadow .2s;width:100%}
  input:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(34,197,94,.15)}
  .btn{width:100%;padding:12px;background:var(--green);border:none;border-radius:10px;color:#000;font-size:14px;font-weight:700;font-family:'Sora',sans-serif;cursor:pointer;transition:background .15s;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:8px}
  .btn:hover{background:var(--green2)}
  .err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;color:#ef4444;font-size:13px;padding:10px 14px;margin-bottom:16px;display:none}
</style>
</head>
<body>
<div class="bg-grid"></div><div class="glow"></div>
<div class="card">
  <div class="logo">
    <div class="logo-icon">
      <svg width="24" height="24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    </div>
    <div><div class="logo-text">EcoWaste</div><div class="logo-sub">Manager</div></div>
  </div>
  <h1>Bem-vindo de volta</h1>
  <p>Entre com suas credenciais de funcionário.</p>
  <div class="err" id="err"></div>
  <div class="field"><label>Usuário</label><input id="user" type="text" placeholder="nome.usuario" autocomplete="username"></div>
  <div class="field"><label>Senha</label><input id="pass" type="password" placeholder="••••••••" autocomplete="current-password"></div>
  <button class="btn" id="loginBtn" onclick="doLogin()">
    <span id="btnText">Entrar</span>
  </button>
</div>
<script>
  document.addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  async function doLogin() {
    const u = document.getElementById('user').value.trim();
    const p = document.getElementById('pass').value;
    const err = document.getElementById('err');
    const btn = document.getElementById('loginBtn');
    const txt = document.getElementById('btnText');
    if (!u || !p) { err.style.display='block'; err.textContent='Preencha usuário e senha.'; return; }
    txt.textContent = 'Entrando...'; btn.disabled = true;
    const r = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username:u,password:p}) });
    const d = await r.json();
    if (d.ok) { window.location.href = '/app'; }
    else { err.style.display='block'; err.textContent = d.error||'Credenciais inválidas.'; txt.textContent='Entrar'; btn.disabled=false; }
  }
</script>
</body></html>`;
}

// ════════════════════════════════════════════════════════════════
//  MAIN APP PAGE
// ════════════════════════════════════════════════════════════════
function appPage(user) {
  const isSupervisor = user.role === 'supervisor';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>EcoWaste Manager</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>${sharedCSS}</style>
</head>
<body>
<div id="toast-container"></div>
<div class="sidebar-overlay" id="sidebar-overlay" onclick="closeMobileSidebar()"></div>
<button class="mobile-menu-btn" id="mobile-menu-btn" onclick="toggleMobileSidebar()" title="Menu">
  <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
</button>

<div class="app">
<!-- ── Sidebar ── -->
<aside class="sidebar" id="sidebar">
  <div class="sidebar-logo">
    <svg width="28" height="28" fill="none" stroke="#22c55e" stroke-width="2" viewBox="0 0 24 24">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
    <span class="sidebar-logo-text">EcoWaste</span>
    <button class="sidebar-toggle" id="sidebar-toggle" title="Recolher">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
  </div>

  <nav class="nav">
    <div class="nav-section">Principal</div>
    <button class="nav-item active" data-page="dashboard" onclick="navigate('dashboard')">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      <span>Dashboard</span>
    </button>

    <div class="nav-section">Empresas</div>
    <button class="nav-item" data-page="empresas" onclick="navigate('empresas');loadEmpresas()">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4"/></svg>
      <span>Consultar</span>
    </button>
    ${isSupervisor ? `<button class="nav-item" data-page="cadastrar" onclick="navigate('cadastrar')">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
      <span>Cadastrar</span>
    </button>` : ''}

    <div class="nav-section">Gerenciamento</div>
    ${isSupervisor ? `<button class="nav-item" data-page="global" onclick="navigate('global')">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
      <span>Global</span>
    </button>` : ''}
    <button class="nav-item" data-page="empresa" onclick="navigate('empresa');loadEmpresasSelect()">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
      <span>Por Empresa</span>
    </button>

    <div class="nav-section">Análise</div>
    <button class="nav-item" data-page="relatorios" onclick="navigate('relatorios');loadRelatorios()">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 17H5a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3M9 11H5m4-4H5m11 6h-5m2 4h-2M13 21h8M19 17l4 4-4-4"/></svg>
      <span>Relatórios</span>
    </button>

    ${isSupervisor ? `<div class="nav-section">Admin</div>
    <button class="nav-item" data-page="config" onclick="navigate('config')">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>
      <span>Configurações</span>
    </button>` : ''}
  </nav>

  <div class="sidebar-footer">
    <button class="nav-item" onclick="logout()">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
      <span>Sair</span>
    </button>
  </div>
</aside>

<!-- ── Main ── -->
<div class="main" id="main">
  <header class="topbar">
    <span class="topbar-title">Dashboard</span>
    <div class="topbar-right">
      <div class="user-chip">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        <span>${user.nome || user.username}</span>
        <span class="role">${user.role}</span>
      </div>
    </div>
  </header>

  <div class="content">

    <!-- ══ DASHBOARD ══ -->
    <div class="page active" id="page-dashboard">
      <div class="stat-grid" id="stat-grid">
        <div class="stat-card"><div class="stat-label">Empresas Cadastradas</div><div class="stat-value stat-green" id="st-empresas">—</div><div class="stat-sub">Total no sistema</div></div>
        <div class="stat-card"><div class="stat-label">Resíduos Totais (ton)</div><div class="stat-value stat-amber" id="st-residuos">—</div><div class="stat-sub">Soma acumulada</div></div>
        <div class="stat-card"><div class="stat-label">Resíduos Tratados (ton)</div><div class="stat-value stat-blue" id="st-tratados">—</div><div class="stat-sub">Total tratado</div></div>
        <div class="stat-card"><div class="stat-label">Taxa de Tratamento</div><div class="stat-value stat-green" id="st-taxa">—</div><div class="stat-sub">Percentual médio</div></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <div class="card-icon ci-green"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
            <h2>Resíduos por Empresa (Top 8)</h2>
          </div>
          <div class="chart-container"><canvas id="chartEmpresa"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header">
            <div class="card-icon ci-blue"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
            <h2>Atualizações por Mês</h2>
          </div>
          <div class="chart-container"><canvas id="chartMensal"></canvas></div>
        </div>
      </div>
    </div>

    <!-- ══ CONSULTAR EMPRESAS ══ -->
    <div class="page" id="page-empresas">
      <div class="section-top">
        <h1>Empresas Cadastradas</h1>
        <div class="flex gap-2 items-center">
          <div class="search-bar">
            <svg width="16" height="16" fill="none" stroke="#94a3b8" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" id="searchEmpresas" placeholder="Buscar por nome fantasia..." oninput="filterEmpresas()">
          </div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th class="hide-mobile">#</th><th>Nome Fantasia</th><th class="hide-mobile">CNPJ</th><th class="hide-mobile">Responsável</th><th class="hide-mobile">Telefone</th><th>Status</th><th>Ações</th>
          </tr></thead>
          <tbody id="tbl-empresas"><tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text3)">Carregando...</td></tr></tbody>
        </table>
      </div>
      <div class="pagination" id="pag-empresas"></div>
    </div>

    <!-- ══ CADASTRAR EMPRESA ══ -->
    ${isSupervisor ? `<div class="page" id="page-cadastrar">
      <div class="section-top"><h1>Cadastrar Nova Empresa</h1></div>
      <div class="card mb-4">
        <div class="card-header"><div class="card-icon ci-green"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4"/></svg></div><h2>Dados da Empresa</h2></div>
        <div class="form-grid" id="form-empresa">
          <div class="form-group"><label>Nome da Empresa *</label><input type="text" id="f-nome" required></div>
          <div class="form-group"><label>CNPJ *</label><input type="text" id="f-cnpj" data-mask="cnpj" maxlength="18" required></div>
          <div class="form-group"><label>Razão Social</label><input type="text" id="f-razao"></div>
          <div class="form-group"><label>Nome Fantasia *</label><input type="text" id="f-fantasia" required></div>
          <div class="form-group"><label>E-mail</label><input type="email" id="f-email"></div>
          <div class="form-group"><label>Data de Abertura</label><input type="date" id="f-abertura"></div>
          <div class="form-group"><label>Telefone</label><input type="text" id="f-tel" data-mask="phone"></div>
          <div class="form-group form-full"><label>Endereço Completo</label><input type="text" id="f-end" placeholder="CEP, Rua, Bairro, Cidade, Estado, Número"></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-icon ci-amber"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div><h2>Dados do Responsável</h2></div>
        <div class="form-grid">
          <div class="form-group"><label>Nome do Responsável</label><input type="text" id="f-resp"></div>
          <div class="form-group"><label>CPF</label><input type="text" id="f-cpf" data-mask="cpf" maxlength="14"></div>
          <div class="form-group"><label>Data de Nascimento</label><input type="date" id="f-nasc"></div>
          <div class="form-group"><label>E-mail do Responsável</label><input type="email" id="f-emailresp"></div>
          <div class="form-group"><label>Contato</label><input type="text" id="f-contato" data-mask="phone"></div>
        </div>
        <div class="divider"></div>
        <div class="flex gap-2">
          <button class="btn btn-primary" onclick="cadastrarEmpresa()">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8"/></svg>
            Salvar Empresa
          </button>
          <button class="btn btn-secondary" onclick="clearEmpresaForm()">Limpar</button>
        </div>
      </div>
    </div>` : '<div class="page" id="page-cadastrar"></div>'}

    <!-- ══ GERENCIAMENTO GLOBAL ══ -->
    ${isSupervisor ? `<div class="page" id="page-global">
      <div class="section-top"><h1>Gerenciamento Global</h1></div>
      <div class="card mb-4">
        <div class="card-header"><div class="card-icon ci-blue"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg></div><h2>Novo Registro Global</h2></div>
        <div class="form-grid">
          <div class="form-group"><label>Região *</label><input type="text" id="g-regiao"></div>
          <div class="form-group"><label>Semestre</label><input type="text" id="g-semestre" placeholder="ex: 1S/2024"></div>
          <div class="form-group form-full"><label>Indústrias com Menor Produção</label><textarea id="g-industrias"></textarea></div>
          <div class="form-group"><label>Aporte Financeiro Semestral</label><input type="text" id="g-aporte" placeholder="R$ 0,00"></div>
        </div>
        <div class="divider"></div>
        <button class="btn btn-primary" onclick="salvarGlobal()">Salvar Registro Global</button>
      </div>
      <div class="card">
        <div class="card-header"><h2>Registros Globais</h2></div>
        <div class="table-wrap">
          <table><thead><tr><th>Região</th><th>Semestre</th><th>Aporte</th><th>Data</th></tr></thead>
          <tbody id="tbl-global"><tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text3)">Carregando...</td></tr></tbody></table>
        </div>
      </div>
    </div>` : '<div class="page" id="page-global"></div>'}

    <!-- ══ GERENCIAMENTO POR EMPRESA ══ -->
    <div class="page" id="page-empresa">
      <div class="section-top"><h1>Gerenciamento por Empresa</h1></div>
      <div class="card mb-4">
        <div class="card-header"><div class="card-icon ci-amber"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div><h2>Novo Registro de Empresa</h2></div>
        <div class="form-grid">
          <div class="form-group"><label>Empresa *</label>
            <select id="ge-empresa"><option value="">Selecione...</option></select>
          </div>
          <div class="form-group"><label>Data Atualização</label><input type="date" id="ge-data"></div>
          <div class="form-group"><label>Qtd. Resíduos (ton)</label><input type="number" id="ge-residuos" step="0.01" oninput="calcPercent()"></div>
          <div class="form-group"><label>Qtd. Tratados (ton)</label><input type="number" id="ge-tratados" step="0.01" oninput="calcPercent()"></div>
          <div class="form-group"><label>% Tratado</label><input type="text" id="ge-percent" readonly style="color:var(--green)"></div>
          <div class="form-group"><label>Custo Total (R$)</label><input type="number" id="ge-custo" step="0.01"></div>
        </div>
        <div class="divider"></div>
        <button class="btn btn-primary" onclick="salvarEmpresa()">Salvar Registro</button>
      </div>
      <div class="card">
        <div class="card-header"><h2>Histórico de Registros</h2></div>
        <div class="table-wrap">
          <table><thead><tr><th>Empresa</th><th class="hide-mobile">Data</th><th class="hide-mobile">Resíduos (ton)</th><th>Tratados (ton)</th><th>% Tratado</th><th class="hide-mobile">Custo</th></tr></thead>
          <tbody id="tbl-empresa-ger"><tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3)">Carregando...</td></tr></tbody></table>
        </div>
      </div>
    </div>

   <!-- ══ RELATÓRIOS ══ -->
    <div class="page" id="page-relatorios">
      <div class="section-top">
        <h1>Relatórios</h1>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm" onclick="exportRelCSV()">⬇ CSV</button>
          <button class="btn btn-secondary btn-sm" onclick="exportRelTXT()">⬇ TXT</button>
        </div>
      </div>
      <div class="card mb-4">
        <div class="card-header"><h2>Filtros</h2></div>
        <div class="form-grid">
          <div class="form-group">
            <label>Empresa</label>
            <select id="rel-empresa"><option value="">Todas</option></select>
          </div>
          <div class="form-group">
            <label>Data Início</label>
            <input type="date" id="rel-inicio">
          </div>
          <div class="form-group">
            <label>Data Fim</label>
            <input type="date" id="rel-fim">
          </div>
          <div class="form-group" style="justify-content:flex-end;padding-top:18px">
            <button class="btn btn-primary" onclick="loadRelatorios()">Filtrar</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table><thead><tr><th>Empresa</th><th class="hide-mobile">Data</th><th>Resíduos (ton)</th><th class="hide-mobile">Tratados (ton)</th><th>% Tratado</th><th class="hide-mobile">Custo (R$)</th></tr></thead><tbody id="tbl-relatorios"></tbody></table>
        </div>
        <div class="pagination" id="pag-rel"></div>
      </div>
    </div>

    <!-- ══ CONFIG ══ -->
    ${isSupervisor ? `<div class="page" id="page-config">
      <div class="section-top"><h1>Configurações</h1></div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><div class="card-icon ci-green"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div><h2>Novo Funcionário</h2></div>
          <div class="form-grid">
            <div class="form-group"><label>Nome Completo</label><input type="text" id="cf-nome"></div>
            <div class="form-group"><label>Usuário *</label><input type="text" id="cf-user"></div>
            <div class="form-group"><label>Senha *</label><input type="password" id="cf-pass"></div>
            <div class="form-group"><label>Nível</label>
              <select id="cf-role"><option value="atendente">Atendente</option><option value="supervisor">Supervisor</option></select>
            </div>
          </div>
          <div class="divider"></div>
          <button class="btn btn-primary" onclick="cadastrarFuncionario()">Cadastrar</button>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-icon ci-amber"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div><h2>Alterar Minha Senha</h2></div>
          <div class="form-grid">
            <div class="form-group form-full"><label>Senha Atual</label><input type="password" id="cp-atual"></div>
            <div class="form-group"><label>Nova Senha</label><input type="password" id="cp-nova"></div>
            <div class="form-group"><label>Confirmar</label><input type="password" id="cp-conf"></div>
          </div>
          <div class="divider"></div>
          <button class="btn btn-primary" onclick="alterarSenha()">Alterar Senha</button>
        </div>
      </div>
      <div class="card mt-4">
        <div class="card-header"><h2>Funcionários</h2></div>
        <div class="table-wrap">
          <table><thead><tr><th>#</th><th>Nome</th><th>Usuário</th><th>Nível</th><th>Cadastrado</th><th>Ações</th></tr></thead>
          <tbody id="tbl-funcionarios"></tbody></table>
        </div>
      </div>
    </div>` : '<div class="page" id="page-config"></div>'}

  </div><!-- /content -->
</div><!-- /main -->
</div><!-- /app -->

<!-- ══ MODAL: Visualizar Empresa ══ -->
<div class="modal-overlay" id="modal-empresa">
  <div class="modal">
    <div class="modal-header">
      <h3 id="modal-emp-title">Detalhes da Empresa</h3>
      <button class="close-btn" onclick="closeModal('modal-empresa')">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body" id="modal-emp-body"></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal('modal-empresa')">Fechar</button>
    </div>
  </div>
</div>

<!-- ══ MODAL: Confirmar Exclusão ══ -->
<div class="modal-overlay" id="modal-delete">
  <div class="modal">
    <div class="modal-header">
      <h3>Confirmar Exclusão</h3>
      <button class="close-btn" onclick="closeModal('modal-delete')">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="modal-body"><p style="color:var(--text2)">Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.</p></div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal('modal-delete')">Cancelar</button>
      <button class="btn btn-danger" id="btn-confirm-delete">Excluir</button>
    </div>
  </div>
</div>

<script>
${sharedJS}

const IS_SUPERVISOR = ${isSupervisor};
let empresasData = [];
let relatoriosData = [];
let chartEmpresa, chartMensal;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  applyMasks();
  loadDashboard();
  loadGlobalTable();
  loadEmpresaGerTable();
  loadRelatorios();
  if (IS_SUPERVISOR) loadFuncionarios();
  // Set today's date on date inputs
  const today = new Date().toISOString().split('T')[0];
  const d1 = document.getElementById('ge-data');
  if (d1) d1.value = today;
});

// ── Logout ────────────────────────────────────────────────────
async function logout() {
  await fetch('/api/logout', { method:'POST' });
  window.location.href = '/';
}

// ── Dashboard ─────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const d = await api('/api/dashboard');
    document.getElementById('st-empresas').textContent = d.total_empresas || 0;
    document.getElementById('st-residuos').textContent = fNum(d.total_residuos || 0);
    document.getElementById('st-tratados').textContent = fNum(d.total_tratados || 0);
    document.getElementById('st-taxa').textContent = fNum(d.taxa_media || 0) + '%';

    // Wait for Chart.js to be available (CDN load delay)
    await waitForChart();
    renderChartEmpresa(d.chart_empresa || []);
    renderChartMensal(d.chart_mensal || []);
  } catch(e) {
    console.error('Dashboard error:', e);
    toast('Erro ao carregar dashboard.', 'error');
  }
}

function waitForChart() {
  return new Promise((resolve) => {
    if (typeof Chart !== 'undefined') return resolve();
    let tries = 0;
    const interval = setInterval(() => {
      tries++;
      if (typeof Chart !== 'undefined') { clearInterval(interval); resolve(); }
      else if (tries > 50) { clearInterval(interval); resolve(); } // give up after 5s
    }, 100);
  });
}

function fNum(n) {
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

function renderChartEmpresa(data) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('chartEmpresa');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (chartEmpresa) chartEmpresa.destroy();
  chartEmpresa = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.nome),
      datasets: [
        { label: 'Resíduos', data: data.map(d => d.residuos), backgroundColor: 'rgba(245,158,11,.6)', borderRadius: 4 },
        { label: 'Tratados', data: data.map(d => d.tratados), backgroundColor: 'rgba(34,197,94,.7)', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#2a3448' } },
        y: { ticks: { color: '#64748b' }, grid: { color: '#2a3448' } }
      }
    }
  });
}

function renderChartMensal(data) {
  if (typeof Chart === 'undefined') return;
  const canvas = document.getElementById('chartMensal');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (chartMensal) chartMensal.destroy();
  chartMensal = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.mes),
      datasets: [{
        label: 'Atualizações', data: data.map(d => d.count),
        borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,.1)',
        tension: 0.4, fill: true, pointBackgroundColor: '#3b82f6'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#2a3448' } },
        y: { ticks: { color: '#64748b' }, grid: { color: '#2a3448' } }
      }
    }
  });
}

// ── Empresas ──────────────────────────────────────────────────
async function loadEmpresas() {
  const res = await api('/api/empresas');
  empresasData = res.data || [];
  renderEmpresasTable(empresasData);
}

function filterEmpresas() {
  const q = document.getElementById('searchEmpresas').value.toLowerCase();
  const filtered = empresasData.filter(e =>
    (e.nome_fantasia||'').toLowerCase().includes(q) ||
    (e.nome_empresa||'').toLowerCase().includes(q) ||
    (e.cnpj||'').includes(q)
  );
  renderEmpresasTable(filtered);
}

function renderEmpresasTable(data) {
  const tb = document.getElementById('tbl-empresas');
  if (!data.length) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text3)">Nenhuma empresa encontrada.</td></tr>'; return; }
  tb.innerHTML = data.map((e, i) => \`
    <tr>
      <td class="mono text-muted hide-mobile">\${e.id}</td>
      <td><strong>\${e.nome_fantasia||'—'}</strong><br><small class="text-muted">\${e.nome_empresa||''}</small></td>
      <td class="mono hide-mobile">\${maskDisplay(e.cnpj,'cnpj')}</td>
      <td class="hide-mobile">\${e.nome_responsavel||'—'}</td>
      <td class="hide-mobile">\${e.telefone||'—'}</td>
      <td><span class="badge \${e.ativo?'badge-green':'badge-red'}">\${e.ativo?'Ativa':'Inativa'}</span></td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-secondary btn-sm btn-icon" title="Visualizar" onclick="verEmpresa(\${e.id})">👁</button>
          \${IS_SUPERVISOR ? \`<button class="btn btn-danger btn-sm btn-icon" title="Excluir" onclick="confirmarDelete(\${e.id})">🗑</button>\` : ''}
        </div>
      </td>
    </tr>
  \`).join('');
}

function maskDisplay(v, type) {
  if (!v) return '—';
  if (type === 'cnpj') return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (type === 'cpf')  return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4');
  return v;
}

async function verEmpresa(id) {
  const res = await api('/api/empresas/' + id);
  const e = res.data;
  if (!e) return toast('Empresa não encontrada', 'error');
  document.getElementById('modal-emp-title').textContent = e.nome_fantasia || 'Empresa';
  document.getElementById('modal-emp-body').innerHTML = \`
    <div class="form-grid" style="font-size:13px">
      \${row('Nome', e.nome_empresa)} \${row('CNPJ', maskDisplay(e.cnpj,'cnpj'))}
      \${row('Razão Social', e.razao_social)} \${row('Nome Fantasia', e.nome_fantasia)}
      \${row('E-mail', e.email)} \${row('Data Abertura', fDate(e.data_abertura))}
      \${row('Telefone', e.telefone)} \${row('Endereço', e.endereco)}
      \${row('Responsável', e.nome_responsavel)} \${row('CPF', maskDisplay(e.cpf_responsavel,'cpf'))}
      \${row('Nasc.', fDate(e.data_nascimento))} \${row('Email Resp.', e.email_responsavel)}
      \${row('Contato', e.contato_responsavel)}
    </div>
  \`;
  openModal('modal-empresa');
}

function row(label, value) {
  return \`<div class="form-group"><label>\${label}</label><div style="padding:8px 0;color:var(--text)">\${value||'—'}</div></div>\`;
}

function fDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function confirmarDelete(id) {
  document.getElementById('btn-confirm-delete').onclick = () => deleteEmpresa(id);
  openModal('modal-delete');
}

async function deleteEmpresa(id) {
  const r = await api('/api/empresas/' + id, { method: 'DELETE' });
  closeModal('modal-delete');
  if (r.ok) { toast('Empresa excluída.'); loadEmpresas(); }
  else toast(r.error || 'Erro ao excluir.', 'error');
}

// ── Cadastrar Empresa ─────────────────────────────────────────
async function cadastrarEmpresa() {
  const body = {
    nome_empresa:    document.getElementById('f-nome').value,
    cnpj:            document.getElementById('f-cnpj').value.replace(/\D/g,''),
    razao_social:    document.getElementById('f-razao').value,
    nome_fantasia:   document.getElementById('f-fantasia').value,
    email:           document.getElementById('f-email').value,
    data_abertura:   document.getElementById('f-abertura').value,
    endereco:        document.getElementById('f-end').value,
    telefone:        document.getElementById('f-tel').value,
    nome_responsavel:document.getElementById('f-resp').value,
    cpf_responsavel: document.getElementById('f-cpf').value.replace(/\D/g,''),
    data_nascimento: document.getElementById('f-nasc').value,
    email_responsavel: document.getElementById('f-emailresp').value,
    contato_responsavel: document.getElementById('f-contato').value
  };
  if (!body.nome_empresa || !body.cnpj || !body.nome_fantasia) return toast('Preencha os campos obrigatórios.', 'error');
  const r = await api('/api/empresas', { method: 'POST', body: JSON.stringify(body) });
  if (r.ok) { toast('Empresa cadastrada!'); clearEmpresaForm(); loadDashboard(); }
  else toast(r.error || 'Erro ao cadastrar.', 'error');
}

function clearEmpresaForm() {
  ['f-nome','f-cnpj','f-razao','f-fantasia','f-email','f-abertura','f-end','f-tel','f-resp','f-cpf','f-nasc','f-emailresp','f-contato'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
}

// ── Gerenciamento Global ───────────────────────────────────────
async function salvarGlobal() {
  const body = {
    regiao: document.getElementById('g-regiao').value,
    semestre: document.getElementById('g-semestre').value,
    industrias_menor_prod: document.getElementById('g-industrias').value,
    aporte_financeiro: document.getElementById('g-aporte').value
  };
  if (!body.regiao) return toast('Informe a região.', 'error');
  const r = await api('/api/global', { method: 'POST', body: JSON.stringify(body) });
  if (r.ok) { toast('Registro global salvo!'); loadGlobalTable(); ['g-regiao','g-semestre','g-industrias','g-aporte'].forEach(id => { document.getElementById(id).value = ''; }); }
  else toast(r.error || 'Erro.', 'error');
}

async function loadGlobalTable() {
  const res = await api('/api/global');
  const tb = document.getElementById('tbl-global');
  if (!tb) return;
  const data = res.data || [];
  if (!data.length) { tb.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text3)">Nenhum registro.</td></tr>'; return; }
  tb.innerHTML = data.map(r => \`<tr>
    <td>\${r.regiao}</td><td class="badge badge-blue">\${r.semestre||'—'}</td>
    <td>\${r.aporte_financeiro||'—'}</td><td class="text-muted">\${fDate(r.created_at)}</td>
  </tr>\`).join('');
}

// ── Gerenciamento por Empresa ─────────────────────────────────
async function loadEmpresasSelect() {
  const res = await api('/api/empresas');
  const data = res.data || [];
  ['ge-empresa','rel-empresa'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Selecione...</option>' + data.map(e => \`<option value="\${e.id}">\${e.nome_fantasia}</option>\`).join('');
    sel.value = cur;
  });
  loadEmpresaGerTable();
}

function calcPercent() {
  const r = parseFloat(document.getElementById('ge-residuos').value) || 0;
  const t = parseFloat(document.getElementById('ge-tratados').value) || 0;
  const p = r > 0 ? ((t / r) * 100).toFixed(1) : '0.0';
  document.getElementById('ge-percent').value = p + '%';
}

async function salvarEmpresa() {
  const empresaId = document.getElementById('ge-empresa').value;
  if (!empresaId) return toast('Selecione uma empresa.', 'error');
  const r = parseFloat(document.getElementById('ge-residuos').value) || 0;
  const t = parseFloat(document.getElementById('ge-tratados').value) || 0;
  const body = {
    empresa_id: empresaId,
    data_atualizacao: document.getElementById('ge-data').value,
    quantidade_residuos: r,
    quantidade_tratados: t,
    percentual_tratado: r > 0 ? ((t/r)*100).toFixed(2) : 0,
    custo_total: parseFloat(document.getElementById('ge-custo').value) || 0
  };
  const res = await api('/api/gerenciamento-empresa', { method: 'POST', body: JSON.stringify(body) });
  if (res.ok) { toast('Registro salvo!'); loadEmpresaGerTable(); loadDashboard(); ['ge-residuos','ge-tratados','ge-custo','ge-percent'].forEach(id => { document.getElementById(id).value = ''; }); }
  else toast(res.error || 'Erro.', 'error');
}

async function loadEmpresaGerTable() {
  const res = await api('/api/gerenciamento-empresa');
  const tb = document.getElementById('tbl-empresa-ger');
  if (!tb) return;
  const data = res.data || [];
  if (!data.length) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text3)">Nenhum registro.</td></tr>'; return; }
  tb.innerHTML = data.slice(0,20).map(r => \`<tr>
    <td>\${r.nome_empresa}</td>
    <td class="hide-mobile">\${fDate(r.data_atualizacao)}</td>
    <td class="text-amber hide-mobile">\${fNum(r.quantidade_residuos)}</td>
    <td class="text-green">\${fNum(r.quantidade_tratados)}</td>
    <td><span class="badge \${r.percentual_tratado>=70?'badge-green':r.percentual_tratado>=40?'badge-amber':'badge-red'}">\${Number(r.percentual_tratado).toFixed(1)}%</span></td>
    <td class="hide-mobile">R$ \${fNum(r.custo_total)}</td>
  </tr>\`).join('');
}

// ── Relatórios ────────────────────────────────────────────────
async function loadRelatorios() {
  // populate select
  const res0 = await api('/api/empresas');
  const sel = document.getElementById('rel-empresa');
  if (sel && res0.data) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">Todas</option>' + res0.data.map(e => \`<option value="\${e.id}">\${e.nome_fantasia}</option>\`).join('');
    sel.value = cur;
  }

  const empresaId = document.getElementById('rel-empresa')?.value || '';
  const inicio    = document.getElementById('rel-inicio')?.value || '';
  const fim       = document.getElementById('rel-fim')?.value || '';
  let url = '/api/relatorios?';
  if (empresaId) url += 'empresa_id=' + empresaId + '&';
  if (inicio) url += 'inicio=' + inicio + '&';
  if (fim) url += 'fim=' + fim;
  const res = await api(url);
  relatoriosData = res.data || [];
  renderRelTable(relatoriosData);
}

function renderRelTable(data) {
  const tb = document.getElementById('tbl-relatorios');
  if (!tb) return;
  if (!data.length) {
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">Nenhum resultado.</td></tr>';
    return;
  }
  // Adicionada a barra invertida \ antes de cada crase e antes de cada $
  tb.innerHTML = data.map(r => \`
    <tr>
      <td>\${r.nome_empresa}</td>
      <td class="hide-mobile">\${fDate(r.data_atualizacao)}</td>
      <td>\${fNum(r.quantidade_residuos)}</td>
      <td class="hide-mobile">\${fNum(r.quantidade_tratados)}</td>
      <td><span class="badge \${r.percentual_tratado>=70?'badge-green':r.percentual_tratado>=40?'badge-amber':'badge-red'}">\${Number(r.percentual_tratado).toFixed(1)}%</span></td>
      <td class="hide-mobile">R$ \${fNum(r.custo_total)}</td>
    </tr>
  \`).join('');
}
function exportRelCSV() { exportCSV(relatoriosData, 'relatorio-ecowaste.csv'); }
function exportRelTXT() { exportTXT(relatoriosData, 'relatorio-ecowaste.txt'); }

// ── Configurações ─────────────────────────────────────────────
async function cadastrarFuncionario() {
  const body = {
    nome: document.getElementById('cf-nome').value,
    username: document.getElementById('cf-user').value,
    password: document.getElementById('cf-pass').value,
    role: document.getElementById('cf-role').value
  };
  if (!body.username || !body.password) return toast('Preencha usuário e senha.', 'error');
  const r = await api('/api/usuarios', { method: 'POST', body: JSON.stringify(body) });
  if (r.ok) { toast('Funcionário cadastrado!'); loadFuncionarios(); ['cf-nome','cf-user','cf-pass'].forEach(id => { document.getElementById(id).value = ''; }); }
  else toast(r.error || 'Erro.', 'error');
}

async function alterarSenha() {
  const atual = document.getElementById('cp-atual').value;
  const nova  = document.getElementById('cp-nova').value;
  const conf  = document.getElementById('cp-conf').value;
  if (nova !== conf) return toast('Senhas não coincidem.', 'error');
  const r = await api('/api/usuarios/senha', { method: 'PUT', body: JSON.stringify({ atual, nova }) });
  if (r.ok) { toast('Senha alterada!'); ['cp-atual','cp-nova','cp-conf'].forEach(id => { document.getElementById(id).value = ''; }); }
  else toast(r.error || 'Erro.', 'error');
}

async function loadFuncionarios() {
  const res = await api('/api/usuarios');
  const tb = document.getElementById('tbl-funcionarios');
  if (!tb) return;
  const data = res.data || [];
  tb.innerHTML = data.map(u => \`<tr>
    <td class="mono text-muted">\${u.id}</td>
    <td>\${u.nome||'—'}</td>
    <td class="mono">\${u.username}</td>
    <td><span class="badge \${u.role==='supervisor'?'badge-green':'badge-blue'}">\${u.role}</span></td>
    <td class="text-muted">\${fDate(u.created_at)}</td>
    <td><button class="btn btn-danger btn-sm" onclick="deleteFuncionario(\${u.id})">Remover</button></td>
  </tr>\`).join('');
}

async function deleteFuncionario(id) {
  if (!confirm('Remover este funcionário?')) return;
  const r = await api('/api/usuarios/' + id, { method: 'DELETE' });
  if (r.ok) { toast('Funcionário removido.'); loadFuncionarios(); }
  else toast(r.error || 'Erro.', 'error');
}
</script>
</body>
</html>`;
}

// ════════════════════════════════════════════════════════════════
//  ROUTES
// ════════════════════════════════════════════════════════════════

// ── Pages ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/app');
  res.send(loginPage());
});

app.get('/app', requireAuth, (req, res) => {
  res.send(appPage(req.session.user));
});

// ── Auth ──────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ ok: false, error: 'Preencha todos os campos.' });
  const r = await pool.query('SELECT * FROM usuarios WHERE username=$1', [username]);
  if (!r.rows.length) return res.json({ ok: false, error: 'Usuário não encontrado.' });
  const user = r.rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.json({ ok: false, error: 'Senha incorreta.' });
  req.session.user = { id: user.id, username: user.username, nome: user.nome, role: user.role };
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// ── Dashboard ─────────────────────────────────────────────────
app.get('/api/dashboard', requireAuth, async (req, res) => {
  const [emp, ger, chart, mensal] = await Promise.all([
    pool.query(`SELECT COUNT(*) as total_empresas FROM empresas WHERE ativo=true`),
    pool.query(`SELECT COALESCE(SUM(quantidade_residuos),0) as total_residuos, COALESCE(SUM(quantidade_tratados),0) as total_tratados, COALESCE(AVG(percentual_tratado),0) as taxa_media FROM gerenciamento_empresa`),
    pool.query(`SELECT e.nome_fantasia as nome, COALESCE(SUM(g.quantidade_residuos),0) as residuos, COALESCE(SUM(g.quantidade_tratados),0) as tratados FROM empresas e LEFT JOIN gerenciamento_empresa g ON g.empresa_id=e.id GROUP BY e.id,e.nome_fantasia ORDER BY residuos DESC LIMIT 8`),
    pool.query(`SELECT TO_CHAR(data_atualizacao,'MM/YYYY') as mes, COUNT(*) as count FROM gerenciamento_empresa WHERE data_atualizacao IS NOT NULL GROUP BY mes ORDER BY MIN(data_atualizacao) DESC LIMIT 12`)
  ]);
  res.json({
    ...emp.rows[0],
    ...ger.rows[0],
    chart_empresa: chart.rows,
    chart_mensal: mensal.rows.reverse()
  });
});

// ── Empresas CRUD ──────────────────────────────────────────────
app.get('/api/empresas', requireAuth, async (req, res) => {
  const r = await pool.query('SELECT * FROM empresas ORDER BY id DESC');
  res.json({ data: r.rows });
});

app.get('/api/empresas/:id', requireAuth, async (req, res) => {
  const r = await pool.query('SELECT * FROM empresas WHERE id=$1', [req.params.id]);
  res.json({ data: r.rows[0] || null });
});

app.post('/api/empresas', requireAuth, requireSupervisor, async (req, res) => {
  const { nome_empresa, cnpj, razao_social, nome_fantasia, email, data_abertura, endereco, telefone,
          nome_responsavel, data_nascimento, cpf_responsavel, email_responsavel, contato_responsavel } = req.body;
  if (!nome_empresa || !cnpj || !nome_fantasia)
    return res.json({ ok: false, error: 'Campos obrigatórios faltando.' });
  await pool.query(
    `INSERT INTO empresas (nome_empresa,cnpj,razao_social,nome_fantasia,email,data_abertura,endereco,telefone,nome_responsavel,data_nascimento,cpf_responsavel,email_responsavel,contato_responsavel)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [nome_empresa, cnpj, razao_social, nome_fantasia, email,
     data_abertura || null, endereco, telefone, nome_responsavel,
     data_nascimento || null, cpf_responsavel, email_responsavel, contato_responsavel]
  );
  res.json({ ok: true });
});

app.delete('/api/empresas/:id', requireAuth, requireSupervisor, async (req, res) => {
  await pool.query('UPDATE empresas SET ativo=false WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ── Gerenciamento Global ────────────────────────────────────────
app.get('/api/global', requireAuth, async (req, res) => {
  const r = await pool.query('SELECT * FROM gerenciamento_global ORDER BY created_at DESC LIMIT 50');
  res.json({ data: r.rows });
});

app.post('/api/global', requireAuth, requireSupervisor, async (req, res) => {
  const { regiao, semestre, industrias_menor_prod, aporte_financeiro } = req.body;
  if (!regiao) return res.json({ ok: false, error: 'Região obrigatória.' });
  await pool.query(
    `INSERT INTO gerenciamento_global (regiao,semestre,industrias_menor_prod,aporte_financeiro) VALUES ($1,$2,$3,$4)`,
    [regiao, semestre, industrias_menor_prod, aporte_financeiro]
  );
  res.json({ ok: true });
});

// ── Gerenciamento por Empresa ───────────────────────────────────
app.get('/api/gerenciamento-empresa', requireAuth, async (req, res) => {
  const r = await pool.query(
    `SELECT ge.*, e.nome_fantasia as nome_empresa FROM gerenciamento_empresa ge
     LEFT JOIN empresas e ON e.id=ge.empresa_id ORDER BY ge.created_at DESC LIMIT 100`
  );
  res.json({ data: r.rows });
});

app.post('/api/gerenciamento-empresa', requireAuth, async (req, res) => {
  const { empresa_id, data_atualizacao, quantidade_residuos, quantidade_tratados, percentual_tratado, custo_total } = req.body;
  if (!empresa_id) return res.json({ ok: false, error: 'Empresa obrigatória.' });
  // Get empresa name
  const emp = await pool.query('SELECT nome_fantasia FROM empresas WHERE id=$1', [empresa_id]);
  const nome = emp.rows[0]?.nome_fantasia || '';
  await pool.query(
    `INSERT INTO gerenciamento_empresa (empresa_id,nome_empresa,data_atualizacao,quantidade_residuos,quantidade_tratados,percentual_tratado,custo_total)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [empresa_id, nome, data_atualizacao || null, quantidade_residuos, quantidade_tratados, percentual_tratado, custo_total]
  );
  res.json({ ok: true });
});

// ── Relatórios ─────────────────────────────────────────────────
app.get('/api/relatorios', requireAuth, async (req, res) => {
  const { empresa_id, inicio, fim } = req.query;
  let query = `SELECT ge.*, e.nome_fantasia as nome_empresa FROM gerenciamento_empresa ge
               LEFT JOIN empresas e ON e.id=ge.empresa_id WHERE 1=1`;
  const params = [];
  if (empresa_id) { params.push(empresa_id); query += ` AND ge.empresa_id=$${params.length}`; }
  if (inicio)     { params.push(inicio);     query += ` AND ge.data_atualizacao>=$${params.length}`; }
  if (fim)        { params.push(fim);        query += ` AND ge.data_atualizacao<=$${params.length}`; }
  query += ' ORDER BY ge.data_atualizacao DESC LIMIT 500';
  const r = await pool.query(query, params);
  res.json({ data: r.rows });
});

// ── Usuários ───────────────────────────────────────────────────
app.get('/api/usuarios', requireAuth, requireSupervisor, async (req, res) => {
  const r = await pool.query('SELECT id,username,nome,role,created_at FROM usuarios ORDER BY id');
  res.json({ data: r.rows });
});

app.post('/api/usuarios', requireAuth, requireSupervisor, async (req, res) => {
  const { nome, username, password, role } = req.body;
  if (!username || !password) return res.json({ ok: false, error: 'Usuário e senha obrigatórios.' });
  const exists = await pool.query('SELECT id FROM usuarios WHERE username=$1', [username]);
  if (exists.rows.length) return res.json({ ok: false, error: 'Usuário já existe.' });
  const hash = await bcrypt.hash(password, 10);
  await pool.query('INSERT INTO usuarios (nome,username,password_hash,role) VALUES ($1,$2,$3,$4)',
    [nome, username, hash, role || 'atendente']);
  res.json({ ok: true });
});

app.put('/api/usuarios/senha', requireAuth, async (req, res) => {
  const { atual, nova } = req.body;
  const r = await pool.query('SELECT * FROM usuarios WHERE id=$1', [req.session.user.id]);
  const user = r.rows[0];
  const match = await bcrypt.compare(atual, user.password_hash);
  if (!match) return res.json({ ok: false, error: 'Senha atual incorreta.' });
  const hash = await bcrypt.hash(nova, 10);
  await pool.query('UPDATE usuarios SET password_hash=$1 WHERE id=$2', [hash, user.id]);
  res.json({ ok: true });
});

app.delete('/api/usuarios/:id', requireAuth, requireSupervisor, async (req, res) => {
  if (Number(req.params.id) === req.session.user.id)
    return res.json({ ok: false, error: 'Não pode remover a si mesmo.' });
  await pool.query('DELETE FROM usuarios WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════
//  START
// ════════════════════════════════════════════════════════════════
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🌿 EcoWaste Manager rodando em http://localhost:${PORT}`);
      console.log(`   Login padrão: admin / Admin@2024`);
    });
  })
  .catch(err => {
    console.error('❌ Erro ao inicializar banco:', err.message);
    process.exit(1);
  });