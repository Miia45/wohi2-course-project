const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();


const seedQuestion = [
  {
    question: "What art form is described as decorative handwriting or handwritten lettering?",
    answer: "Calligraphy",
    keywords: ["art"],
  },
  {
    question: "Who was the Ancient Greek God of the Sun?",
    answer: "Apollo",
    keywords: ["history"],
  },
  {
    question: "What is a word, phrase, number, or other sequence of characters that reads the same backward as forward?",
    answer: "Palindrome",
    keywords: ["general"],
  },
  {
    question: "Which animal sleeps standing up and can’t vomit? ",
    answer: "Horse",
    keywords: ["general"],
  },
  {
    question: "Which country invented French fries?",
    answer: "Belgium",
    keywords: ["general"],
  },
];

async function main() {
  await prisma.question.deleteMany();
  await prisma.user.deleteMany();
  await prisma.keyword.deleteMany();

  const hashedPassword = await bcrypt.hash("1234", 10);
  const user = await prisma.user.create({
    data: {
      email: "admin@example",
      password: hashedPassword,
      name: "Admin User",
    },
  });
  
  console.log("Created user:", user.email);

  for (const question of seedQuestion) {
    await prisma.question.create({
      data: {
        question: question.question,
        answer: question.answer,
        userId: user.id,
        keywords: {
          connectOrCreate: question.keywords.map((kw) => ({
            where: {name: kw},
            create: {name: kw},
      })),
    },
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

