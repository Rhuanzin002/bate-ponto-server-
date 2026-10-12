const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Conexão explícita para evitar falhas de leitura na URL com pontos no utilizador
const pool = new Pool({
    user: 'postgres.lzsysfyagmoscypffzxc',
    password: 'Cavalo0021804',
    host: 'aws-0-us-east-1.pooler.supabase.com',
    database: 'postgres',
    port: 6543,
    ssl: {
        rejectUnauthorized: false
    },
    family: 4
});


// 2. ROTA: Dados do Painel do Pai (Resumo e Histórico)
app.get('/api/painel', async (req, res) => {
    try {
        const historicoRes = await pool.query(
            `SELECT id, nome, data_hora as "dataHora", pago, desconsiderado FROM pontos ORDER BY data_hora DESC`
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

// 3. ROTA: Marcar como Pago (Zera os pontos pendentes daquele funcionário)
app.post('/api/pagar', async (req, res) => {
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
app.patch('/api/ponto/:id/desconsiderar', async (req, res) => {
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