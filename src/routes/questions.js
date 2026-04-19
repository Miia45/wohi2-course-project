const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");


// GET /questions
// List all questions
router.get("/", async (req, res) => {

  const questions = await prisma.question.findMany({
    orderBy: {id: "asc"},
  });

  res.json(questions);
});

//GET
//show specific question
router.get("/:questionsId", async (req, res) => {
  const questionsId = Number(req.params.questionsId);
  const question = await prisma.question.findUnique({
    where: { id: questionsId },
  });

  if (!question) {
    return res.status(404).json({
      message: "Question not found :("
    });
  }
  
  res.json(question);
});

//POST
router.post("/", async (req, res) => {
    const {question, answer} = req.body;

    if (!question || !answer ) {
        return res.status(400).json({msg:"question and answer are required"})
    }

    const newQuestion = await prisma.question.create({
      data: { question, answer },
      }); 
      
      res.status(201).json(newQuestion);
});

//PUT /api/questions/:quetionsId
router.put("/:questionsId", async (req, res) => {
    const questionsId = Number(req.params.questionsId);
    const {question, answer} = req.body;

    const existingQuestion = await prisma.question.findUnique({where: {id: questionsId} });

    if (!existingQuestion) {
      return res.status(404).json({msg: "question and answer are mandatory"});
    }

    const updatedQuestion = await prisma.question.update({
      where: { id: questionsId },
      data: { question, answer },
    });

    res.json(updatedQuestion);
  });


//DELETE /api/quetions/:quetionsId
router.delete("/:questionsId", async (req, res) => {
    const questionsId = Number(req.params.questionsId);
    const question = await prisma.question.findUnique({
      where: { id: questionsId },
    });

    if (!question) {
        return res.status(404).json({msg:"question not found"})
    }
    await prisma.question.delete({where: {id: questionsId } });

    res.json({msg:"Question deleted successfully",
        question:(question),
    });
});   

module.exports = router;