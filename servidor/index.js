const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ ATUALIZE AQUI CASO USE VARIÁVEL DE AMBIENTE
const CLIENT_ID = process.env.CLIENT_ID || '652659079305130';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'bcHDdHFAijKYPA7s3C73oHmr2U9tSIlP';
const REDIRECT_URI = process.env.REDIRECT_URI || 'https://encontrae.onrender.com/callback';

let tokenData = {};

// Serve os arquivos estáticos da pasta /public
app.use(express.static('public'));

// Rota de login que redireciona para o Mercado Livre
app.get('/login', (req, res) => {
  const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}`;
  res.redirect(authUrl);
});

// Rota de callback para receber o código de autorização
app.get('/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('Código não fornecido.');
  }

  try {
    const response = await axios.post('https://api.mercadolibre.com/oauth/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    });

    tokenData = response.data;

    // Salva localmente (opcional)
    fs.writeFileSync(path.join(__dirname, 'tokens.json'), JSON.stringify(tokenData, null, 2));

    res.send('<h2>✅ Autenticado com sucesso! Token salvo.</h2>');
  } catch (error) {
    console.error('Erro ao obter token:', error.response?.data || error.message);
    res.status(500).send('Erro ao obter token.');
  }
});

// Rota para exibir o perfil do usuário
app.get('/perfil', async (req, res) => {
  if (!tokenData.access_token) {
    return res.send('❌ Não autenticado.');
  }

  try {
    const perfil = await axios.get('https://api.mercadolibre.com/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    res.json(perfil.data);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send('Erro ao buscar perfil.');
  }
});

// Rota para exibir os produtos anunciados
app.get('/produtos', async (req, res) => {
  if (!tokenData.access_token) {
    return res.send('❌ Não autenticado.');
  }

  try {
    // Primeiro busca o ID do usuário
    const perfil = await axios.get('https://api.mercadolibre.com/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const userId = perfil.data.id;

    // Agora busca os itens publicados
    const itens = await axios.get(`https://api.mercadolibre.com/users/${userId}/items/search`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (itens.data.results.length === 0) {
      return res.send('<h2>⚠️ Nenhum produto encontrado.</h2>');
    }

    // Pega até 10 itens para não sobrecarregar
    const ids = itens.data.results.slice(0, 10).join(',');

    const detalhes = await axios.get(`https://api.mercadolibre.com/items?ids=${ids}`);

    // Monta o HTML para exibir
    const htmlProdutos = detalhes.data.map(item => {
      const produto = item.body;
      return `
        <div style="border:1px solid #ccc; margin:10px; padding:10px;">
          <h3>${produto.title}</h3>
          <img src="${produto.thumbnail}" alt="${produto.title}" width="150"/>
          <p>Preço: R$ ${(produto.price).toFixed(2)}</p>
          <a href="${produto.permalink}" target="_blank">Ver anúncio</a>
        </div>
      `;
    }).join('');

    res.send(`<h2>📦 Produtos Anunciados</h2>${htmlProdutos}`);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send('Erro ao buscar produtos.');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
