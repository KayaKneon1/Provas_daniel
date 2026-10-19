const authScreen = document.querySelector('#tela-autenticacao')
const appScreen = document.querySelector('#tela-aplicacao')
const authForm = document.querySelector('#formulario-autenticacao')
const authName = document.querySelector('#campo-nome')
const authError = document.querySelector('#erro-autenticacao')
const authTitle = document.querySelector('#titulo-autenticacao')
const authDescription = document.querySelector('#descricao-autenticacao')
const authSubmit = document.querySelector('#botao-autenticacao')
const authSwitch = document.querySelector('#alternar-autenticacao')
const authSwitchText = document.querySelector('#texto-alternar-autenticacao')
const content = document.querySelector('#conteudo')
const dialog = document.querySelector('#dialogo-registro')
const dialogForm = document.querySelector('#formulario-registro')
const dialogFields = document.querySelector('#campos-dialogo')
const dialogError = document.querySelector('#erro-dialogo')
const toast = document.querySelector('#notificacao')

let usuarioAtual = null
let viewAtual = 'inicio'
let modoCadastro = false
let toastTimer

// Define os títulos e as descrições usados nas páginas da aplicação.
const viewInfo = {
  inicio: { title: 'Visão geral', description: 'Um resumo simples para você cuidar bem do seu dinheiro.' },
  contas: { title: 'Contas', description: 'Gerencie suas contas e saldos iniciais.' },
  categorias: { title: 'Categorias', description: 'Organize suas receitas e despesas.' },
  lancamentos: { title: 'Lançamentos', description: 'Acompanhe tudo o que entra e sai.' }
}

// Envia uma requisição à API e trata respostas vazias ou com erro.
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  })
  if (response.status === 204) return null
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || 'Não foi possível concluir a operação.')
  return result
}

// Exibe uma mensagem temporária na tela.
function showToast(message) {
  toast.textContent = message
  toast.classList.add('visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200)
}

// Alterna entre a tela de autenticação e a aplicação após login ou logout.
function setAuthenticated(usuario) {
  usuarioAtual = usuario
  authScreen.classList.toggle('oculto', Boolean(usuario))
  appScreen.classList.toggle('oculto', !usuario)
  if (!usuario) return
  document.querySelector('#boas-vindas').textContent = `Olá, ${usuario.nome.split(' ')[0]}!`
  document.querySelector('#nome-perfil').textContent = usuario.nome
  document.querySelector('#inicial-perfil').textContent = usuario.nome.trim().charAt(0).toUpperCase()
  loadView(viewAtual)
}

// Atualiza textos e campos do formulário entre cadastro e login.
function updateAuthMode() {
  authName.classList.toggle('oculto', !modoCadastro)
  authTitle.textContent = modoCadastro ? 'Vamos começar por você.' : 'Bom ter você por aqui.'
  authDescription.textContent = modoCadastro
    ? 'Crie sua conta para organizar suas finanças.'
    : 'Entre para acompanhar sua vida financeira.'
  authSubmit.textContent = modoCadastro ? 'Criar minha conta' : 'Entrar'
  authSwitchText.textContent = modoCadastro ? 'Já tem cadastro?' : 'Ainda não tem cadastro?'
  authSwitch.textContent = modoCadastro ? 'Fazer login' : 'Criar conta'
  authForm.elements.senha.autocomplete = modoCadastro ? 'new-password' : 'current-password'
  authForm.elements.nome.required = modoCadastro
  authError.textContent = ''
}

// Alterna o formulário entre os modos de cadastro e login.
authSwitch.addEventListener('click', () => {
  modoCadastro = !modoCadastro
  updateAuthMode()
})

// Envia os dados de cadastro ou login e atualiza a tela após o sucesso.
authForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  authError.textContent = ''
  const form = new FormData(authForm)
  const payload = Object.fromEntries(form.entries())
  try {
    const result = await api(`/api/auth/${modoCadastro ? 'register' : 'login'}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    authForm.reset()
    setAuthenticated(result.usuario)
  } catch (error) {
    authError.textContent = error.message
  }
})

// Encerra a sessão no servidor e volta à tela de login.
document.querySelector('#botao-sair').addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' })
    setAuthenticated(null)
  } catch (error) {
    showToast(error.message)
  }
})

// Identifica a página escolhida e atualiza a navegação.
document.querySelector('#navegacao-principal').addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]')
  if (!button) return
  viewAtual = button.dataset.view
  document.querySelectorAll('.link-navegacao').forEach((item) => {
    item.classList.toggle('ativo', item === button)
  })
  loadView(viewAtual)
})

// Cria um elemento HTML com classe e texto opcionais.
function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

// Formata centavos como moeda brasileira.
function formatMoney(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

// Converte centavos para o formato decimal usado no campo de valor.
function moneyInputValue(cents) {
  return (cents / 100).toFixed(2)
}

// Formata uma data para exibição no padrão brasileiro.
function formatDate(value) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR')
}

// Monta o título, a descrição e o botão de ação de uma página.
function heading(title, description, actionLabel, onAction) {
  const wrapper = element('div', 'cabecalho-pagina')
  const titleBlock = element('div')
  titleBlock.append(element('p', 'rotulo-superior', 'SEU DINHEIRO, SOB SEU CONTROLE'))
  titleBlock.append(element('h1', '', title))
  titleBlock.append(element('p', '', description))
  wrapper.append(titleBlock)
  if (actionLabel) {
    const button = element('button', 'botao botao-principal', `＋ ${actionLabel}`)
    button.type = 'button'
    button.addEventListener('click', onAction)
    wrapper.append(button)
  }
  return wrapper
}

// Monta uma tabela ou uma mensagem quando não há registros.
function table(headers, rows, emptyText) {
  const panel = element('div', 'painel-tabela')
  if (rows.length === 0) {
    const empty = element('div', 'estado-vazio')
    empty.append(element('strong', '', 'Ainda não há registros'))
    empty.append(document.createTextNode(emptyText))
    panel.append(empty)
    return panel
  }

  const scroll = element('div', 'rolagem-tabela')
  const tableElement = document.createElement('table')
  const head = document.createElement('thead')
  const headerRow = document.createElement('tr')
  headers.forEach((name) => headerRow.append(element('th', '', name)))
  head.append(headerRow)
  tableElement.append(head)
  const body = document.createElement('tbody')
  rows.forEach((cells) => {
    const row = document.createElement('tr')
    cells.forEach((cell) => {
      const td = document.createElement('td')
      if (cell instanceof Node) td.append(cell)
      else td.textContent = String(cell)
      row.append(td)
    })
    body.append(row)
  })
  tableElement.append(body)
  scroll.append(tableElement)
  panel.append(scroll)
  return panel
}

// Cria os botões de edição e exclusão de uma linha da tabela.
function actionCell(record, edit, remove) {
  const actions = element('div', 'acoes-linha')
  const editButton = element('button', 'botao-linha', 'Editar')
  editButton.type = 'button'
  editButton.addEventListener('click', () => openRecordDialog(record))
  const deleteButton = element('button', 'botao-linha excluir', 'Excluir')
  deleteButton.type = 'button'
  deleteButton.addEventListener('click', () => deleteRecord(record))
  actions.append(editButton, deleteButton)
  return actions
}

// Cria uma etiqueta visual para o tipo de registro.
function tag(text, type) {
  const className = type === 'RECEITA' ? 'etiqueta-tipo receita' : type === 'DESPESA' ? 'etiqueta-tipo despesa' : 'etiqueta-tipo'
  return element('span', className, labelType(type))
}

// Traduz os valores internos dos tipos para rótulos legíveis.
function labelType(type) {
  const names = {
    RECEITA: 'Receita',
    DESPESA: 'Despesa',
    CORRENTE: 'Conta corrente',
    POUPANCA: 'Poupança',
    INVESTIMENTO: 'Investimento',
    DINHEIRO: 'Dinheiro'
  }
  return names[type] || type
}

// Cria os cartões de resumo com saldo e quantidades cadastradas.
function renderStats(stats) {
  const values = [
    ['Saldo total', formatMoney(stats.saldoCentavos), 'Contas + receitas − despesas', '◉'],
    ['Contas', stats.quantidadeContas, 'Contas cadastradas', '▤'],
    ['Categorias', stats.quantidadeCategorias, 'Categorias organizadas', '◈'],
    ['Lançamentos', stats.quantidadeLancamentos, 'Movimentações registradas', '↕']
  ]
  const grid = element('div', 'grade-estatisticas')
  values.forEach(([name, value, hint, icon]) => {
    const card = element('section', 'cartao-estatistica')
    const top = element('div', 'topo-estatistica')
    top.append(element('span', '', name), element('span', 'icone-estatistica', icon))
    card.append(top, element('strong', 'valor-estatistica', String(value)), element('p', 'dica-estatistica', hint))
    grid.append(card)
  })
  return grid
}

// Carrega e exibe o resumo financeiro e os lançamentos recentes.
async function renderDashboard() {
  const [stats, lancamentos] = await Promise.all([
    api('/api/dashboard'),
    api('/api/lancamentos')
  ])
  content.append(heading(viewInfo.inicio.title, viewInfo.inicio.description))
  content.append(renderStats(stats))
  const panel = element('section', 'painel')
  const panelHeading = element('div', 'cabecalho-painel')
  const title = element('div')
  title.append(element('h2', '', 'Movimentações recentes'), element('p', '', 'Suas últimas receitas e despesas'))
  const button = element('button', 'botao botao-secundario', 'Ver lançamentos')
  button.type = 'button'
  button.addEventListener('click', () => navigate('lancamentos'))
  panelHeading.append(title, button)
  panel.append(panelHeading)
  panel.append(table(
    ['Descrição', 'Categoria', 'Data', 'Tipo', 'Valor'],
    lancamentos.slice(0, 5).map((item) => [
      item.descricao,
      item.categoria.nome,
      formatDate(item.data),
      tag(item.tipo),
      element('span', item.tipo === 'RECEITA' ? 'valor-receita' : 'valor-despesa',
        `${item.tipo === 'RECEITA' ? '+' : '−'} ${formatMoney(item.valorCentavos)}`)
    ]),
    'Adicione um lançamento para acompanhar seu saldo por aqui.'
  ))
  content.append(panel)
}

// Abre uma página e atualiza o item selecionado na navegação.
function navigate(view) {
  viewAtual = view
  document.querySelectorAll('.link-navegacao').forEach((button) => {
    button.classList.toggle('ativo', button.dataset.view === view)
  })
  loadView(view)
}

// Carrega e mostra a lista de contas.
async function renderContas() {
  const records = await api('/api/contas')
  content.append(heading(viewInfo.contas.title, viewInfo.contas.description, 'Nova conta', () => openRecordDialog()))
  content.append(table(
    ['Nome da conta', 'Tipo', 'Saldo inicial', 'Ações'],
    records.map((record) => [
      record.nome,
      tag(record.tipo),
      formatMoney(record.saldoInicialCentavos),
      actionCell(record)
    ]),
    'Cadastre uma conta bancária, investimento ou dinheiro em espécie.'
  ))
}

// Carrega e mostra a lista de categorias.
async function renderCategorias() {
  const records = await api('/api/categorias')
  content.append(heading(viewInfo.categorias.title, viewInfo.categorias.description, 'Nova categoria', () => openRecordDialog()))
  content.append(table(
    ['Nome da categoria', 'Tipo', 'Ações'],
    records.map((record) => [record.nome, tag(record.tipo), actionCell(record)]),
    'Crie categorias como salário, moradia ou alimentação.'
  ))
}

// Carrega e mostra a lista de lançamentos.
async function renderLancamentos() {
  const records = await api('/api/lancamentos')
  content.append(heading(viewInfo.lancamentos.title, viewInfo.lancamentos.description, 'Novo lançamento', () => openRecordDialog()))
  content.append(table(
    ['Descrição', 'Categoria', 'Conta', 'Data', 'Tipo', 'Valor', 'Ações'],
    records.map((record) => [
      record.descricao,
      record.categoria.nome,
      record.conta.nome,
      formatDate(record.data),
      tag(record.tipo),
      element('span', record.tipo === 'RECEITA' ? 'valor-receita' : 'valor-despesa',
        `${record.tipo === 'RECEITA' ? '+' : '−'} ${formatMoney(record.valorCentavos)}`),
      actionCell(record)
    ]),
    'Registre uma receita ou despesa para começar.'
  ))
}

// Seleciona e carrega a página atual, exibindo erros de carregamento.
async function loadView(view) {
  if (!usuarioAtual) return
  content.replaceChildren(element('p', 'texto-discreto', 'Carregando...'))
  try {
    content.replaceChildren()
    if (view === 'inicio') await renderDashboard()
    else if (view === 'contas') await renderContas()
    else if (view === 'categorias') await renderCategorias()
    else await renderLancamentos()
  } catch (error) {
    content.replaceChildren()
    const notice = element('div', 'estado-vazio')
    notice.append(element('strong', '', 'Não foi possível carregar os dados'))
    notice.append(document.createTextNode(error.message))
    content.append(notice)
  }
}

// Cria um campo de formulário, incluindo opções para listas suspensas.
function field(labelText, name, type = 'text', options = {}) {
  const wrapper = element('label', 'campo')
  wrapper.append(element('span', '', labelText))
  const input = document.createElement(type === 'select' ? 'select' : 'input')
  input.name = name
  if (type !== 'select') input.type = type
  if (options.required !== false) input.required = true
  if (options.min !== undefined) input.min = options.min
  if (options.max !== undefined) input.max = options.max
  if (options.step !== undefined) input.step = options.step
  if (options.maxLength !== undefined) input.maxLength = options.maxLength
  if (options.placeholder) input.placeholder = options.placeholder
  if (options.options) {
    options.options.forEach(([value, text]) => {
      const option = document.createElement('option')
      option.value = value
      option.textContent = text
      input.append(option)
    })
  }
  wrapper.append(input)
  return wrapper
}

// Prepara e abre o formulário para criar ou editar um registro.
function openRecordDialog(record = null) {
  dialogError.textContent = ''
  dialogFields.replaceChildren()
  const entity = viewAtual
  const fields = []
  if (entity === 'contas') {
    fields.push(field('Nome da conta', 'nome', 'text', { maxLength: 80, placeholder: 'Ex.: Conta principal' }))
    fields.push(field('Tipo de conta', 'tipo', 'select', {
      options: [
        ['CORRENTE', 'Conta corrente'], ['POUPANCA', 'Poupança'],
        ['INVESTIMENTO', 'Investimento'], ['DINHEIRO', 'Dinheiro']
      ]
    }))
    fields.push(field('Saldo inicial (R$)', 'saldoInicial', 'number', { min: 0, step: '0.01', placeholder: '0,00' }))
  } else if (entity === 'categorias') {
    fields.push(field('Nome da categoria', 'nome', 'text', { maxLength: 60, placeholder: 'Ex.: Moradia' }))
    fields.push(field('Tipo', 'tipo', 'select', {
      options: [['DESPESA', 'Despesa'], ['RECEITA', 'Receita']]
    }))
  } else {
    fields.push(field('Descrição', 'descricao', 'text', { maxLength: 120, placeholder: 'Ex.: Conta de luz' }))
    fields.push(field('Tipo de lançamento', 'tipo', 'select', {
      options: [['DESPESA', 'Despesa'], ['RECEITA', 'Receita']]
    }))
    fields.push(field('Valor (R$)', 'valor', 'number', { min: 0.01, step: '0.01', placeholder: '0,00' }))
    fields.push(field('Data', 'data', 'date'))
    fields.push(field('Conta', 'contaId', 'select', { options: [['', 'Selecione uma conta']] }))
    fields.push(field('Categoria', 'categoriaId', 'select', { options: [['', 'Selecione uma categoria']] }))
  }
  fields.forEach((item) => dialogFields.append(item))
  document.querySelector('#titulo-dialogo').textContent = `${record ? 'Editar' : 'Nova'} ${entity === 'lancamentos' ? 'movimentação' : entity === 'contas' ? 'conta' : 'categoria'}`
  document.querySelector('#salvar-dialogo').textContent = record ? 'Salvar alterações' : 'Salvar registro'

  if (entity === 'lancamentos') {
    fillTransactionOptions(record)
  }
  if (record) {
    Object.entries(record).forEach(([name, value]) => {
      const inputName = name === 'saldoInicialCentavos' ? 'saldoInicial'
        : name === 'valorCentavos' ? 'valor' : name
      const input = dialogForm.elements[inputName]
      if (!input) return
      if (name === 'saldoInicial' || name === 'saldoInicialCentavos') {
        dialogForm.elements.saldoInicial.value = moneyInputValue(record.saldoInicialCentavos)
      } else if (name === 'valor' || name === 'valorCentavos') {
        dialogForm.elements.valor.value = moneyInputValue(record.valorCentavos)
      } else if (name === 'data') {
        input.value = String(value).slice(0, 10)
      } else if (name !== 'saldoInicialCentavos' && name !== 'valorCentavos') {
        input.value = value
      }
    })
  } else if (entity === 'lancamentos') {
    dialogForm.elements.data.value = new Date().toISOString().slice(0, 10)
  }
  dialog.showModal()
}

// Carrega as contas e categorias disponíveis no formulário de lançamento.
async function fillTransactionOptions(record) {
  try {
    const [contas, categorias] = await Promise.all([api('/api/contas'), api('/api/categorias')])
    const accountSelect = dialogForm.elements.contaId
    const categorySelect = dialogForm.elements.categoriaId
    if (!accountSelect || !categorySelect || !dialog.open) return
    accountSelect.replaceChildren()
    categorySelect.replaceChildren()
    const accountPlaceholder = document.createElement('option')
    accountPlaceholder.value = ''
    accountPlaceholder.textContent = 'Selecione uma conta'
    accountSelect.append(accountPlaceholder)
    contas.forEach((conta) => {
      const option = document.createElement('option')
      option.value = conta.id
      option.textContent = conta.nome
      accountSelect.append(option)
    })
    // Mostra somente categorias compatíveis com o tipo selecionado.
    const addCategories = () => {
      const selectedType = dialogForm.elements.tipo.value
      categorySelect.replaceChildren()
      const placeholder = document.createElement('option')
      placeholder.value = ''
      placeholder.textContent = 'Selecione uma categoria'
      categorySelect.append(placeholder)
      categorias.filter((item) => item.tipo === selectedType).forEach((categoria) => {
        const option = document.createElement('option')
        option.value = categoria.id
        option.textContent = categoria.nome
        categorySelect.append(option)
      })
    }
    dialogForm.elements.tipo.addEventListener('change', addCategories)
    addCategories()
    if (record) {
      accountSelect.value = record.contaId
      categorySelect.value = record.categoriaId
    }
  } catch (error) {
    dialogError.textContent = error.message
  }
}

// Confirma e remove o registro selecionado pela API.
async function deleteRecord(record) {
  const itemName = viewAtual === 'contas' ? record.nome : viewAtual === 'categorias' ? record.nome : record.descricao
  if (!window.confirm(`Excluir "${itemName}"? Esta ação não pode ser desfeita.`)) return
  try {
    await api(`/api/${viewAtual}/${record.id}`, { method: 'DELETE' })
    showToast('Registro excluído com sucesso.')
    loadView(viewAtual)
  } catch (error) {
    showToast(error.message)
  }
}

// Fecha o formulário sem salvar as alterações.
document.querySelector('#fechar-dialogo').addEventListener('click', () => dialog.close())
document.querySelector('#cancelar-dialogo').addEventListener('click', () => dialog.close())

// Valida e envia os dados para criar ou editar o registro atual.
dialogForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  dialogError.textContent = ''
  const data = Object.fromEntries(new FormData(dialogForm).entries())
  const isEdit = Boolean(dialog.dataset.recordId)
  const path = `/api/${viewAtual}${isEdit ? `/${dialog.dataset.recordId}` : ''}`

  if (viewAtual === 'contas') {
    data.saldoInicial = Number(data.saldoInicial)
  } else if (viewAtual === 'lancamentos') {
    data.valor = Number(data.valor)
    data.contaId = Number(data.contaId)
    data.categoriaId = Number(data.categoriaId)
  }

  try {
    await api(path, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(data) })
    dialog.close()
    delete dialog.dataset.recordId
    showToast(isEdit ? 'Alterações salvas com sucesso.' : 'Registro criado com sucesso.')
    loadView(viewAtual)
  } catch (error) {
    dialogError.textContent = error.message
  }
})

const originalOpenRecordDialog = openRecordDialog
// Guarda o identificador do registro quando o formulário é aberto para edição.
openRecordDialog = function (record = null) {
  if (record) dialog.dataset.recordId = record.id
  else delete dialog.dataset.recordId
  originalOpenRecordDialog(record)
}

api('/api/auth/session')
  .then((result) => setAuthenticated(result.usuario))
  .catch((error) => {
    authError.textContent = error.message
  })
