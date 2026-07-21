/**
 * GM MESSENGER - Worker Único (Backend + API OTP + Interface Web)
 */

const EMAIL_API_ENDPOINT = "https://email.gmcorporation.com.br/api/messages/send";
const INTERNAL_KEY = "GM-CORP_12345678966";
const SENDER_EMAIL = "sistema@email.gmcorporation.com.br";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    /* 1. ROTA: SOLICITAR CÓDIGO E ENVIAR E-MAIL */
    if (url.pathname === "/api/auth/send-code" && request.method === "POST") {
      try {
        const { email } = await request.json();

        if (!email || !email.endsWith("@email.gmcorporation.com.br")) {
          return Response.json(
            { success: false, error: "Acesso bloqueado: É obrigatório utilizar seu e-mail corporativo (@email.gmcorporation.com.br)." },
            { status: 400, headers: corsHeaders }
          );
        }

        const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();

        // Armazena no KV com expiração de 10 minutos (600s)
        await env.OTP_STORE.put(`otp:${email}`, generatedCode, { expirationTtl: 600 });

        const mailResponse = await fetch(EMAIL_API_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-Key": INTERNAL_KEY
          },
          body: JSON.stringify({
            sender: SENDER_EMAIL,
            recipient: email,
            subject: "GM Messenger - Código de Verificação de Acesso",
            body: `Olá!\n\nSeu código de validação para acessar o GM Messenger é: ${generatedCode}\n\nEste código é de uso pessoal e expira em 10 minutos.`
          })
        });

        const mailData = await mailResponse.json();

        if (mailResponse.ok && mailData.success) {
          return Response.json({ success: true, message: "Código enviado com sucesso para sua caixa de entrada!" }, { headers: corsHeaders });
        } else {
          return Response.json(
            { success: false, error: mailData.error || "Erro no provedor de e-mail ao disparar o código." },
            { status: mailResponse.status || 500, headers: corsHeaders }
          );
        }
      } catch (err) {
        return Response.json({ success: false, error: "Falha interna no servidor de autenticação." }, { status: 500, headers: corsHeaders });
      }
    }

    /* 2. ROTA: VALIDAR CÓDIGO */
    if (url.pathname === "/api/auth/verify-code" && request.method === "POST") {
      try {
        const { email, code } = await request.json();

        if (!email || !code) {
          return Response.json({ success: false, error: "Informe o e-mail e o código recebido." }, { status: 400, headers: corsHeaders });
        }

        const storedCode = await env.OTP_STORE.get(`otp:${email}`);

        if (!storedCode) {
          return Response.json({ success: false, error: "Código expirado ou não encontrado. Solicite um novo." }, { status: 400, headers: corsHeaders });
        }

        if (storedCode === code.trim()) {
          await env.OTP_STORE.delete(`otp:${email}`);
          return Response.json({ success: true, message: "Acesso aprovado com sucesso!" }, { headers: corsHeaders });
        } else {
          return Response.json({ success: false, error: "Código incorreto. Confira no seu e-mail e tente novamente." }, { status: 401, headers: corsHeaders });
        }
      } catch (err) {
        return Response.json({ success: false, error: "Erro ao processar validação do código." }, { status: 500, headers: corsHeaders });
      }
    }

    /* 3. INTERFACE COMPLETA (HTML/CSS/JS) */
    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GM Messenger</title>
  <style>
    :root {
      --bg-dark: #111b21;
      --panel-bg: #202c33;
      --accent: #00a884;
      --text: #e9edef;
      --text-dim: #8696a0;
      --msg-out: #005c4b;
      --msg-in: #202c33;
      --border: #222d34;
      --active-chat: #2a3942;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: var(--bg-dark); color: var(--text); height: 100vh; overflow: hidden; display: flex; justify-content: center; align-items: center; }

    #auth-screen { display: flex; width: 100vw; height: 100vh; justify-content: center; align-items: center; background: #0b141a; }
    .auth-card { background: var(--panel-bg); padding: 2.5rem; border-radius: 12px; width: 100%; max-width: 420px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); }
    .auth-card h2 { color: var(--accent); margin-bottom: 0.5rem; font-size: 1.8rem; text-align: center; }
    .auth-card p { color: var(--text-dim); font-size: 0.85rem; margin-bottom: 1.5rem; text-align: center; }
    .auth-card label { display: block; font-size: 0.8rem; color: var(--text-dim); margin-bottom: 0.3rem; text-transform: uppercase; letter-spacing: 0.5px; }
    .auth-card input { width: 100%; padding: 0.8rem; margin-bottom: 1.2rem; border-radius: 6px; border: 1px solid var(--border); background: #111b21; color: var(--text); font-size: 0.95rem; outline: none; }
    .auth-card input:focus { border-color: var(--accent); }
    .auth-card button { width: 100%; padding: 0.9rem; background: var(--accent); border: none; border-radius: 6px; color: #fff; font-weight: bold; font-size: 1rem; cursor: pointer; transition: background 0.2s; }
    .auth-card button:hover { opacity: 0.9; }
    .banner { padding: 0.7rem; border-radius: 6px; font-size: 0.85rem; margin-bottom: 1rem; display: none; text-align: center; }
    .banner.error { background: #8f1d1d; color: #fff; }
    .banner.success { background: #1b633a; color: #fff; }

    #app-container { display: none; width: 100vw; height: 100vh; grid-template-columns: 380px 1fr; }
    .sidebar { background: var(--panel-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
    .sidebar-header { height: 60px; background: #202c33; display: flex; align-items: center; padding: 0 1rem; border-bottom: 1px solid var(--border); gap: 10px; }
    .user-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: bold; color: #fff; }
    .contacts-list { flex: 1; overflow-y: auto; }
    .contact-item { padding: 0.9rem 1rem; border-bottom: 1px solid #182229; cursor: pointer; display: flex; align-items: center; gap: 12px; }
    .contact-item:hover { background: #111b21; }
    .contact-item.active { background: var(--active-chat); }
    .contact-name { font-weight: 600; font-size: 0.95rem; }
    .contact-email { font-size: 0.75rem; color: var(--text-dim); }

    .chat-area { display: flex; flex-direction: column; background: #0b141a; position: relative; }
    .chat-header { height: 60px; background: var(--panel-bg); display: flex; align-items: center; padding: 0 1rem; border-bottom: 1px solid var(--border); gap: 12px; }
    .messages-container { flex: 1; padding: 1.5rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.8rem; background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 0); background-size: 24px 24px; }
    .message { max-width: 60%; padding: 0.6rem 0.9rem; border-radius: 8px; font-size: 0.9rem; position: relative; word-break: break-word; }
    .message.sent { align-self: flex-end; background: var(--msg-out); }
    .message.received { align-self: flex-start; background: var(--msg-in); }

    .input-bar { height: 62px; background: var(--panel-bg); display: flex; align-items: center; padding: 0 1rem; gap: 10px; position: relative; }
    .input-bar input { flex: 1; padding: 0.7rem 1rem; border-radius: 8px; border: none; background: #2a3942; color: var(--text); outline: none; }
    .btn-icon { background: transparent; border: none; font-size: 1.3rem; cursor: pointer; color: var(--text-dim); padding: 0.4rem; border-radius: 50%; }
    .btn-icon.recording { color: #f44336; animation: pulse 1s infinite; }

    .emoji-picker { position: absolute; bottom: 70px; left: 10px; background: var(--panel-bg); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem; display: none; grid-template-columns: repeat(5, 1fr); gap: 8px; }
    .emoji-btn { background: none; border: none; font-size: 1.4rem; cursor: pointer; }

    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
  </style>
</head>
<body>

  <div id="auth-screen">
    <div class="auth-card">
      <h2>GM Messenger</h2>
      <p>Acesso exclusivo com validação via E-mail Corporativo</p>
      <div id="auth-banner" class="banner"></div>

      <form id="step-email-form" onsubmit="solicitarCodigo(event)">
        <label>E-mail Corporativo OBRIGATÓRIO</label>
        <input type="email" id="user-email" placeholder="usuario@email.gmcorporation.com.br" required />
        <button type="submit" id="btn-send-code">Enviar Código de Acesso</button>
      </form>

      <form id="step-code-form" onsubmit="validarCodigo(event)" style="display: none;">
        <label>Código de 6 Dígitos Enviado</label>
        <input type="text" id="otp-code" placeholder="123456" maxlength="6" required style="letter-spacing: 4px; text-align: center; font-size: 1.2rem;" />
        <button type="submit" id="btn-verify-code">Aprovar e Entrar</button>
      </form>
    </div>
  </div>

  <div id="app-container">
    <div class="sidebar">
      <div class="sidebar-header">
        <div class="user-avatar" id="my-avatar">U</div>
        <div>
          <strong id="user-display-name" style="font-size:0.9rem;">Usuário</strong><br/>
          <small style="color:var(--accent); font-size:0.75rem;">● On-line</small>
        </div>
      </div>
      <div class="contacts-list" id="contacts-list"></div>
    </div>

    <div class="chat-area">
      <div class="chat-header">
        <div class="user-avatar" id="chat-avatar">?</div>
        <div>
          <strong id="current-contact-name">Selecione um contato</strong><br/>
          <small id="current-contact-email" style="color:var(--text-dim); font-size:0.75rem;"></small>
        </div>
      </div>

      <div class="messages-container" id="messages-container"></div>

      <div class="emoji-picker" id="emoji-picker">
        <button class="emoji-btn" onclick="inserirEmoji('😀')">😀</button>
        <button class="emoji-btn" onclick="inserirEmoji('😂')">😂</button>
        <button class="emoji-btn" onclick="inserirEmoji('👍')">👍</button>
        <button class="emoji-btn" onclick="inserirEmoji('❤️')">❤️</button>
        <button class="emoji-btn" onclick="inserirEmoji('🚀')">🚀</button>
      </div>

      <div class="input-bar">
        <button class="btn-icon" onclick="toggleEmojiPicker()">😊</button>
        <button class="btn-icon" id="mic-btn" onclick="toggleGravacaoAudio()">🎙️</button>
        <input type="text" id="msg-input" placeholder="Digite uma mensagem..." onkeypress="if(event.key==='Enter') enviarMensagemTexto()" disabled />
        <button class="btn-icon" onclick="enviarMensagemTexto()">➔</button>
      </div>
    </div>
  </div>

  <script>
    let currentUser = "";
    let activeContact = null;
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    const contatosCorporativos = [
      { nome: "Suporte Técnico", email: "suporte@email.gmcorporation.com.br" },
      { nome: "Diretoria Operational", email: "diretoria@email.gmcorporation.com.br" },
      { nome: "Engenharia de Sistemas", email: "engenharia@email.gmcorporation.com.br" }
    ];

    function exibirBanner(msg, type) {
      const banner = document.getElementById("auth-banner");
      banner.className = "banner " + type;
      banner.innerText = msg;
      banner.style.display = "block";
    }

    async function solicitarCodigo(e) {
      e.preventDefault();
      const email = document.getElementById("user-email").value.trim().toLowerCase();
      const btn = document.getElementById("btn-send-code");

      if (!email.endsWith("@email.gmcorporation.com.br")) {
        exibirBanner("É obrigatório utilizar um e-mail @email.gmcorporation.com.br", "error");
        return;
      }

      btn.disabled = true;
      btn.innerText = "Enviando código...";

      try {
        const res = await fetch("/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          currentUser = email;
          exibirBanner(data.message, "success");
          document.getElementById("step-email-form").style.display = "none";
          document.getElementById("step-code-form").style.display = "block";
        } else {
          exibirBanner(data.error || "Erro ao solicitar código.", "error");
          btn.disabled = false;
          btn.innerText = "Enviar Código de Acesso";
        }
      } catch (err) {
        exibirBanner("Erro na comunicação com o servidor.", "error");
        btn.disabled = false;
      }
    }

    async function validarCodigo(e) {
      e.preventDefault();
      const code = document.getElementById("otp-code").value.trim();
      const btn = document.getElementById("btn-verify-code");

      btn.disabled = true;
      btn.innerText = "Validando...";

      try {
        const res = await fetch("/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: currentUser, code })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          document.getElementById("auth-screen").style.display = "none";
          document.getElementById("app-container").style.display = "grid";
          
          const name = currentUser.split('@')[0];
          document.getElementById("user-display-name").innerText = name;
          document.getElementById("my-avatar").innerText = name.charAt(0).toUpperCase();

          carregarContatos();
        } else {
          exibirBanner(data.error || "Código reprovado.", "error");
          btn.disabled = false;
          btn.innerText = "Aprovar e Entrar";
        }
      } catch (err) {
        exibirBanner("Erro de conexão ao validar o código.", "error");
        btn.disabled = false;
      }
    }

    function carregarContatos() {
      const container = document.getElementById("contacts-list");
      container.innerHTML = "";

      contatosCorporativos.forEach((c) => {
        if (c.email === currentUser) return;
        const div = document.createElement("div");
        div.className = "contact-item";
        div.onclick = () => {
          activeContact = c;
          document.querySelectorAll(".contact-item").forEach(i => i.classList.remove("active"));
          div.classList.add("active");
          document.getElementById("current-contact-name").innerText = c.nome;
          document.getElementById("current-contact-email").innerText = c.email;
          document.getElementById("chat-avatar").innerText = c.nome.charAt(0);
          document.getElementById("msg-input").disabled = false;
          document.getElementById("messages-container").innerHTML = "";
        };

        div.innerHTML = \`<div class="user-avatar">\${c.nome.charAt(0)}</div><div><div class="contact-name">\${c.nome}</div><div class="contact-email">\${c.email}</div></div>\`;
        container.appendChild(div);
      });
    }

    function enviarMensagemTexto() {
      const input = document.getElementById("msg-input");
      const texto = input.value.trim();
      if (!texto || !activeContact) return;

      renderizarMsg(texto, 'sent');
      input.value = "";
    }

    function renderizarMsg(conteudo, tipo, isAudio = false) {
      const container = document.getElementById("messages-container");
      const div = document.createElement("div");
      div.className = \`message \${tipo}\`;

      if (isAudio) {
        const audio = document.createElement("audio");
        audio.src = conteudo;
        audio.controls = true;
        div.appendChild(audio);
      } else {
        div.innerText = conteudo;
      }

      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function toggleEmojiPicker() {
      const p = document.getElementById("emoji-picker");
      p.style.display = p.style.display === "grid" ? "none" : "grid";
    }

    function inserirEmoji(e) {
      document.getElementById("msg-input").value += e;
    }

    async function toggleGravacaoAudio() {
      if (!activeContact) return;
      const btn = document.getElementById("mic-btn");

      if (!isRecording) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];
          mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
          mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            renderizarMsg(URL.createObjectURL(blob), 'sent', true);
          };
          mediaRecorder.start();
          isRecording = true;
          btn.classList.add("recording");
        } catch (err) { alert("Microfone não disponível."); }
      } else {
        mediaRecorder.stop();
        isRecording = false;
        btn.classList.remove("recording");
      }
    }
  </script>
</body>
</html>`;

    return new Response(htmlContent, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
};
