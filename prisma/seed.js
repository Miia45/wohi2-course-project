const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

async function main() {
  await prisma.attempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash("1234", 10);
  const user = await prisma.user.create({
    data: {
      email: "admin@example",
      password: hashedPassword,
      name: "Admin User",
    },
  });
  
  console.log("Created user:", user.email);


  await prisma.question.createMany({ 
    data: [
      {
        question: "What art form is described as decorative handwriting or handwritten lettering?",
        answer: "Calligraphy",
        userId: user.id,
      },
      {
        question: "Who was the Ancient Greek God of the Sun?",
        answer: "Apollo",
        userId: user.id,
      },
      {
        question: "What is a word, phrase, number, or other sequence of characters that reads the same backward as forward?",
        answer: "Palindrome",
        userId: user.id,
      },
      {
        question: "Which animal sleeps standing up and can’t vomit? ",
        answer: "Horse",
        userId: user.id,
      },
      {
        question: "Which country invented French fries?",
        answer: "Belgium",
        userId: user.id,
      },
      {
        question: "2 + 2?",
        answer: "4",
        userId: user.id,
      },
      {
        question: "Largest planet?",
        answer: "Jupiter",
        userId: user.id,
      },
      {
        question: "HTML stands for?",
        answer: "HyperText Markup Language",
        userId: user.id,
      },
      {
        question: "Fastest land animal is...?",
        answer: "Cheetah",
        userId: user.id,
      },
      {
        question: "Capital of Japan?",
        answer: "Tokyo",
        userId: user.id,
      },
    ],
  });
  
  console.log("Seed data inserted successfully");

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


