# Nexus Play - Arremesso de Objetos entre Telas

Nexus Play é uma experiência interativa que permite arremessar objetos virtuais de um celular para outro em tempo real, utilizando WebSockets.

## Como Hospedar no Render (Grátis)

Para colocar seu projeto no ar e testar com amigos:

1.  **Suba seu código para o GitHub**:
    *   Siga as instruções no Google AI Studio (Export to GitHub).
2.  **Crie uma conta no Render**:
    *   Acesse [render.com](https://render.com) e conecte sua conta do GitHub.
3.  **Crie um "Web Service"**:
    *   No painel do Render, clique em **New +** e escolha **Web Service**.
    *   Selecione o repositório do seu projeto.
4.  **Configurações de Deploy**:
    *   **Runtime**: Node
    *   **Build Command**: `npm install; npm run build`
    *   **Start Command**: `npm start`
    *   **Instance Type**: Free (Grátis)
5.  **Acesse o link**:
    *   O Render vai te dar uma URL (ex: `nexus-play.onrender.com`).
    *   Abra esse link em dois dispositivos diferentes e use o mesmo **Código da Sala** para conectá-los.

## Como rodar localmente

Se quiser rodar na sua própria máquina:

1.  Instale as dependências:
    ```bash
    npm install
    ```
2.  Inicie o servidor de desenvolvimento:
    ```bash
    npm run dev
    ```
3.  Abra `http://localhost:3000` no seu navegador.

## Tecnologias usadas
*   React + Vite
*   Tailwind CSS (Estilização)
*   Framer Motion (Animações e Física de Arraste)
*   Socket.io (Comunicação em Tempo Real)
*   Express (Servidor Backend)
