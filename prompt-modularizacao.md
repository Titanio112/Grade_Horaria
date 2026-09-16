# Prompt para o opencode

Copie e cole isso no opencode:

---

Preciso que você modularize o projeto do repositório `Titanio112/Organizador-de-Grade-Hor-ria-com-An-lise-de-Grupo`.

**Contexto atual:**
- O projeto é 100% HTML puro (um único `index.html`, sem build, sem npm, sem Vite).
- O site é publicado direto via GitHub Pages a partir da branch main (sem pipeline de build).
- Quero MANTER assim por enquanto: sem Vite, sem TypeScript, sem npm. Só vanilla JS com ES Modules nativos do navegador.

**Antes de começar — regras gerais de como trabalhar:**

- Crie um arquivo `MEMORIA.md` na raiz do projeto (se não existir ainda) e MANTENHA ele atualizado durante toda a tarefa. Registre nele:
  - O plano que você definiu (etapas)
  - O que já foi feito em cada etapa
  - Erros que apareceram e como foram resolvidos
  - Cada vez que subir código pro GitHub (commit/push), registre o que foi enviado
  - Isso serve pra você não se perder nem alucinar sobre o que já foi feito em sessões futuras — sempre leia o `MEMORIA.md` no início antes de continuar qualquer trabalho nesse projeto.

- Revise as ferramentas/MCPs disponíveis antes de começar e use as mais adequadas pra cada parte da tarefa — principalmente as de teste/bug (ex: playwright) pra verificar se o site continua funcionando igual depois de cada mudança, antes de avançar pra próxima etapa.

- Trabalhe etapa por etapa, com um plano claro:
  1. Mostre o plano completo primeiro
  2. Execute uma etapa por vez
  3. Teste se nada quebrou depois de cada etapa
  4. Só então avance pra próxima
  5. Atualize o `MEMORIA.md` a cada etapa concluída

- Se em algum momento perceber que a tarefa atual pede um tipo de trabalho diferente (ex: sair de "escrever código" pra "revisar/testar" ou "debugar"), troque para o agente/modo mais adequado daquela função em vez de forçar o mesmo agente a fazer tudo.

**O que fazer:**

1. Ler o `index.html` atual e identificar as partes:
   - Dados (matérias, salas, horários, professores)
   - Lógica (regras de conflito de horário, análise de grupo, cálculos)
   - Renderização (código que desenha a grade na tela / manipula o DOM)
   - Inicialização (o que roda quando a página carrega)

2. Separar em arquivos:
   - `dados.js` → só os dados (export de arrays/objetos com matérias, salas, professores, horários)
   - `logica.js` → funções puras de regras e cálculos (sem tocar no DOM)
   - `render.js` → funções que atualizam a tela
   - `main.js` → importa os outros três e conecta tudo (event listeners, chamada inicial)

3. Ajustar o `index.html` para carregar só:
   ```html
   <script type="module" src="main.js"></script>
   ```

4. Usar `import`/`export` do ES Modules nativo — sem bundler, sem build step. Tem que continuar funcionando abrindo o `index.html` direto ou via GitHub Pages, sem nenhuma etapa de compilação.

5. ⚠️ REGRA CRÍTICA: Não mude NENHUM dado (matéria, sala, professor, horário) nessa etapa — é só reorganização de código. Nenhum valor pode ser diferente do original. As atualizações de dados eu faço depois, editando só o `dados.js`. Se tiver qualquer dúvida sobre um valor, não "corrija" nem "melhore" — mantenha exatamente como está no original.

6. No final, testar se o site continua funcionando exatamente igual (mesmo visual, mesmo comportamento) antes de eu subir pro GitHub.

**Regras adicionais de processo:**

7. Existe um arquivo `PROJECT_MEMORY.md` na raiz do projeto (eu já criei). Antes de começar, leia esse arquivo. Ao longo do trabalho:
   - Atualize a seção "Estado atual" marcando as etapas concluídas.
   - Registre no "Log de decisões e planos" cada decisão importante e por quê.
   - Registre no "Log de erros encontrados" qualquer erro, mesmo que já resolvido.
   - Registre no "Log do que já foi enviado ao GitHub" cada push, com resumo do que mudou.
   - Nunca apague histórico antigo desse arquivo, só adicione.
   - Esse arquivo existe pra você não se perder nem alucinar sobre o que já foi feito — trate ele como fonte de verdade acima da sua própria memória de conversa.

8. Não altere nenhum dado de matéria, sala, professor ou horário nessa etapa — isso está reforçado aqui de novo porque é crítico.

9. Antes de começar, revise as ferramentas/MCPs disponíveis (filesystem, github, playwright, sequential-thinking, context7, memory) e diga quais você vai usar e pra quê. Use o playwright (ou outra ferramenta de teste) pra verificar se o site continua funcionando igual antes e depois de cada etapa, sempre que for possível/relevante.

10. Trabalhe em etapas pequenas e sequenciais — nunca aplique tudo de uma vez. Para cada etapa: mostre o plano, espere confirmação, aplique, teste, atualize o PROJECT_MEMORY.md, só então vá pra próxima etapa.

11. Se durante o trabalho você perceber que precisa de uma abordagem ou tipo de raciocínio diferente do que está usando (ex: um problema de bug complexo, uma decisão de arquitetura, uma tarefa de teste), troque para o agente/modo mais adequado para aquilo, avisando que está trocando e por quê.

Me mostra o plano de como você vai dividir antes de mexer no código, e só depois aplica.

---
