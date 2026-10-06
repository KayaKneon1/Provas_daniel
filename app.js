const express = require('express')
const app = express()
const prisma = require('./lib/prisma')
const port = 3000

app.use(express.json())

function logMiddleware(req, res, next) {
  console.log(`${req.method} ${req.url}`)
  next()
}
app.use(logMiddleware)

app.get('/', (req, res) => {
  res.json('Servidor funcionando!!')
})

app.get('/usuarios', async (req, res) => {
  try {
    const usuarios = await prisma.listaUsuarios.findMany()
    res.json(usuarios)
  } catch (erro) {
    console.error(erro)
    res.json({ message: 'Erro ao listar usuários' })
  }
})

app.get('/usuarios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const usuario = await prisma.listaUsuarios.findUnique({
      where: { id }
    })

    if (!usuario) {
      return res.json({ message: 'Usuário não encontrado' })
    }

    res.json(usuario)
  } catch (erro) {
    console.error(erro)
    res.json({ message: 'Erro ao buscar usuário' })
  }
})

app.post('/usuarios', async (req, res) => {
  try {
    const { nome, idade } = req.body
    const novoUsuario = await prisma.listaUsuarios.create({
      data: {
        nome,
        idade: Number(idade)
      }
    })

    res.json(novoUsuario)
  } catch (erro) {
    console.error(erro)
    res.json({ message: 'Erro ao criar usuário' })
  }
})

app.put('/usuarios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)

    const usuario = await prisma.listaUsuarios.update({
      where: { id },
      data: {
        nome: req.body.nome,
        idade: Number(req.body.idade)
      }
    })

    res.json(usuario)
  } catch (erro) {
    console.error(erro)
    res.json({ message: 'Erro ao editar usuário' })
  }
})

app.delete('/usuarios/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const usuarioDeletado = await prisma.listaUsuarios.delete({
      where: { id }
    })

    res.json({
      message: 'Usuário deletado:',
      usuario: usuarioDeletado
    })
  } catch (erro) {
    console.error(erro)
    res.json({ message: 'Erro ao deletar usuário' })
  }
})

app.listen(port, () => {
  console.log(`servidor: http://localhost:${port}`)
})
