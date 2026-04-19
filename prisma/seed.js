const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const seedQuestion = [
  {
    question: "What art form is described as decorative handwriting or handwritten lettering?",
    answer: "Calligraphy",
  },
  {
    question: "Who was the Ancient Greek God of the Sun?",
    answer: "Apollo",
  },
  {
    question: "What is a word, phrase, number, or other sequence of characters that reads the same backward as forward?",
    answer: "Palindrome",
  },
  {
    question: "Which animal sleeps standing up and can’t vomit? ",
    answer: "Horse",
  },
  {
    question: "Which country invented French fries?",
    answer: "Belgium",
  },
];

async function main() {
  await prisma.question.deleteMany();

  for (const question of seedQuestion) {
    await prisma.question.create({
      data: {
        question: question.question,
        answer: question.answer,
      },
    });
  }

  console.log("Seed data inserted successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

