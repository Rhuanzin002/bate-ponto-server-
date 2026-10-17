const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '10mb' })); // Aumenta o limite para aceitar imagens em Base64
app.use(cors());

// ================== SENHA DO PAINEL ==================
const SENHA_PAINEL = process.env.PAINEL_SENHA || 'Gui1804';
// =====================================================

const crypto = require('crypto');

function senhaCorreta(tentativa) {
    const a = crypto.createHash('sha256').update(String(tentativa || '')).digest();
    const b = crypto.createHash('sha256').update(SENHA_PAINEL).digest();
    return crypto.timingSafeEqual(a, b);
}

function exigirSenha(req, res, next) {
    if (senhaCorreta(req.get('x-painel-senha'))) return next();
    return res.status(401).json({ erro: 'Senha incorreta ou ausente.' });
}

// Usada pelo painel para validar a senha digitada
app.get('/api/login', exigirSenha, (req, res) => res.json({ ok: true }));

// Conexão via variável de ambiente DATABASE_URL (transaction pooler do Supabase)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 1. ROTA: Bater Ponto (Funcionário com Selfie e Logs de Diagnóstico)
app.post('/api/ponto', async (req, res) => {
    const { nome, selfie } = req.body;

    // Logs para auditar exatamente o que está chegando ao servidor
    console.log("--- NOVO PEDIDO DE PONTO ---");
    console.log("Nome recebido:", nome);
    console.log("Tem selfie?", selfie ? "Sim (tamanho: " + selfie.length + ")" : "NÃO, veio vazia/undefined");

    if (!nome || !nome.trim()) {
        return res.status(400).json({ erro: 'Nome é obrigatório.' });
    }

    if (!selfie) {
        return res.status(400).json({ erro: 'A selfie é obrigatória.' });
    }

    const nomeFormatado = nome.trim().toLowerCase();

    try {
        const hojeCheck = await pool.query(
            `SELECT * FROM pontos 
             WHERE LOWER(nome) = $1 
             AND DATE(data_hora) = CURRENT_DATE 
             AND desconsiderado = FALSE`,
            [nomeFormatado]
        );

        if (hojeCheck.rows.length > 0) {
            return res.status(400).json({ erro: 'Você já bateu ponto hoje!' });
        }

        await pool.query(
            `INSERT INTO pontos (nome, data_hora, pago, desconsiderado, selfie) VALUES ($1, NOW(), FALSE, FALSE, $2)`,
            [nome.trim(), selfie]
        );

        console.log("Ponto e selfie salvos com sucesso para:", nome);
        res.status(201).json({ mensagem: 'Ponto batido com sucesso!' });
    } catch (err) {
        console.error("ERRO COMPLETO AO REGISTRAR PONTO:", err);
        res.status(500).json({ erro: 'Erro interno no servidor ao registrar ponto: ' + err.message });
    }
});

// 2. ROTA: Dados do Painel do Pai (Inclui a selfie no histórico)
app.get('/api/painel', exigirSenha, async (req, res) => {
    try {
        const historicoRes = await pool.query(
            `SELECT id, nome, data_hora as "dataHora", pago, desconsiderado, selfie FROM pontos ORDER BY data_hora DESC`
        );

        const resumoRes = await pool.query(
            `SELECT nome, COUNT(*) as "pontosPendentes" 
             FROM pontos 
             WHERE pago = FALSE AND desconsiderado = FALSE 
             GROUP BY nome`
        );

        const resumo = resumoRes.rows.map((item, index) => ({
            id: index + 1,
            nome: item.nome,
            pontosPendentes: parseInt(item.pontosPendentes),
            valorDiaria: 50.00
        }));

        res.json({
            resumo,
            historico: historicoRes.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao carregar dados do painel.' });
    }
});

// 3. ROTA: Marcar como Pago
app.post('/api/pagar', exigirSenha, async (req, res) => {
    const { nome } = req.body;

    if (!nome) {
        return res.status(400).json({ erro: 'Nome do funcionário é obrigatório.' });
    }

    try {
        await pool.query(
            `UPDATE pontos SET pago = TRUE WHERE LOWER(nome) = LOWER($1) AND pago = FALSE AND desconsiderado = FALSE`,
            [nome]
        );

        res.json({ mensagem: 'Pagamento registrado com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao registrar pagamento.' });
    }
});

// 4. ROTA: Desconsiderar Ponto Falso
app.patch('/api/ponto/:id/desconsiderar', exigirSenha, async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query(
            `UPDATE pontos SET desconsiderado = TRUE WHERE id = $1`,
            [id]
        );

        res.json({ mensagem: 'Ponto desconsiderado com sucesso!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Erro ao desconsiderar ponto.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT} 🚀`);
});