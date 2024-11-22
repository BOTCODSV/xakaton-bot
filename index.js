//const bot = new Telegraf('8162564843:AAErR9dhTp4TdYZ0jxVXyDStX3DGbzbBGJA');
//const managerId = '1122108485';
const { Telegraf, Markup } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const moment = require('moment');
const schedule = require('node-schedule');
const fs = require('fs');

// Инициализация бота
const bot = new Telegraf('');
const managerId = ' ';
// Инициализация базы данных
let db = new sqlite3.Database('./votes.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the votes database.');
});

// Создание таблиц базы данных
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS teams (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, team_id INTEGER, is_active INTEGER DEFAULT 0)");
  db.run("CREATE TABLE IF NOT EXISTS points (id INTEGER PRIMARY KEY AUTOINCREMENT, team_id INTEGER, member_id INTEGER, points INTEGER, date DATE DEFAULT CURRENT_DATE)");
});

// Логирование действий бота
function logAction(action) {
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  const logEntry = `${timestamp} - ${action}\n`;
  fs.appendFileSync('bot_log.txt', logEntry, (err) => {
    if (err) console.error('Ошибка записи лога:', err);
  });
}

// Приветственное сообщение и регистрация
bot.start((ctx) => {
  const userId = ctx.from.id.toString();
  logAction(`User ${userId} started the bot.`);
  if (userId === managerId) {
    ctx.reply('Доброе утро, проектный менеджер! Перейдите в меню проектного менеджера:', Markup.inlineKeyboard([
      [Markup.button.callback('Меню проектного менеджера', 'manager_menu')]
    ]));
  } else {
    ctx.reply('Привет! Я волшебник, я телеграм-бот, созданный для психологической оценки уровней энергии. Пожалуйста, зарегистрируйтесь:', Markup.inlineKeyboard([
      [Markup.button.callback('Регистрация', 'register')]
    ]));
  }
});

bot.action('register', (ctx) => {
  ctx.reply('Пожалуйста, введите ваше имя и фамилию:');
  bot.on('text', (ctx) => {
    const fullName = ctx.message.text;
    const userId = ctx.from.id;
    logAction(`User ${userId} is registering with name ${fullName}.`);
    
    db.run('INSERT INTO members (id, name) VALUES (?, ?)', [userId, fullName], (err) => {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          ctx.reply('Вы уже зарегистрированы.');
          logAction(`User ${userId} attempted to register again.`);
        } else {
          console.error(err.message);
          logAction(`Error registering user ${userId}: ${err.message}`);
        }
      } else {
        ctx.reply('Регистрация завершена. Доброе утро! Пожалуйста, пройдите психологический тест для оценки энергии:', Markup.inlineKeyboard([
          [Markup.button.callback('Психологический тест для оценки энергии', 'psychological_test')]
        ]));
        logAction(`User ${userId} registered successfully.`);
      }
    });
  });
});

// Меню проектного менеджера
bot.action('manager_menu', (ctx) => {
  const userId = ctx.from.id.toString();
  logAction(`User ${userId} opened manager menu.`);

  if (userId === managerId) {
    ctx.reply('Меню проектного менеджера:', Markup.inlineKeyboard([
      [Markup.button.callback('Создать команду', 'create_team')],
      [Markup.button.callback('Редактировать команду', 'edit_team')],
      [Markup.button.callback('Список команд', 'list_teams')],
      [Markup.button.callback('Статистика по членам команд', 'member_stats')],
      [Markup.button.callback('Рекомендации', 'recommendations')],
      [Markup.button.callback('Статистика дня', 'daily_stats')],
      [Markup.button.callback('Статистика недели', 'weekly_stats')],
      [Markup.button.callback('Общая статистика', 'total_stats')],
      [Markup.button.callback('Назад', 'back_to_main')]
    ]));
  } else {
    ctx.reply('У вас нет прав для управления настройками.', Markup.inlineKeyboard([
      [Markup.button.callback('Назад', 'back_to_main')]
    ]));
  }
});

// Список команд
bot.action('list_teams', (ctx) => {
  db.all('SELECT name FROM teams', [], (err, rows) => {
    if (err) return console.error(err.message);

    const teamList = rows.length ? rows.map(row => `Команда: ${row.name}`).join('\n') : 'Команды не найдены.';
    ctx.reply(`Список команд:\n${teamList}`);
    logAction(`User ${ctx.from.id} viewed list of teams.`);
  });
});

// Психологический тест
const questions = [
  'Вопрос 1: Оцените ваш уровень энергии от 1 до 5.',
  'Вопрос 2: Чувствуете ли вы усталость? (да/нет)',
  'Вопрос 3: У вас есть желание работать? (да/нет)',
  'Вопрос 4: Вы чувствуете себя счастливо? (да/нет)',
  'Вопрос 5: У вас есть проблемы со сном? (да/нет)',
  'Вопрос 6: Вы часто раздражаетесь? (да/нет)',
  'Вопрос 7: Вам легко вставать по утрам? (да/нет)',
  'Вопрос 8: Вы чувствуете усталость на работе? (да/нет)',
  'Вопрос 9: Вам нравится ваша работа? (да/нет)',
  'Вопрос 10: У вас есть проблемы с концентрацией? (да/нет)'
];

let currentQuestion = 0;

bot.action('psychological_test', (ctx) => {
  currentQuestion = 0;
  askNextQuestion(ctx);
});

function askNextQuestion(ctx) {
  if (currentQuestion < questions.length) {
    if (currentQuestion === 0) {
      ctx.reply(questions[currentQuestion], Markup.inlineKeyboard([
        [Markup.button.callback('1', 'answer_1')],
        [Markup.button.callback('2', 'answer_2')],
        [Markup.button.callback('3', 'answer_3')],
        [Markup.button.callback('4', 'answer_4')],
        [Markup.button.callback('5', 'answer_5')]
      ]));
    } else {
      ctx.reply(questions[currentQuestion], Markup.inlineKeyboard([
        [Markup.button.callback('Да', 'answer_yes')],
        [Markup.button.callback('Нет', 'answer_no')]
      ]));
    }
    currentQuestion++;
  } else {
    ctx.reply('Тест завершен. Спасибо за ваши ответы.');
    logAction(`User ${ctx.from.id} completed the psychological test.`);
  }
}

bot.action(/^answer_(\d+|yes|no)$/, (ctx) => {
  const answer = ctx.match[1];
  const userId = ctx.from.id;
  logAction(`User ${userId} answered question ${currentQuestion} with ${answer}.`);

  let points = 0;
  if (currentQuestion === 1) {
    points = parseInt(answer);
  } else {
    points = (answer === 'yes') ? 1 : 0;
  }

  db.get('SELECT team_id FROM members WHERE id = ?', [userId], (err, row) => {
    if (err) return console.error(err.message);

    const teamId = row ? row.team_id : null;
    db.run('INSERT INTO points (team_id, member_id, points, date) VALUES (?, ?, ?, date("now"))', [teamId, userId, points], (err) => {
      if (err) return console.error(err.message);
      logAction(`Points for user ${userId} saved to database.`);
      askNextQuestion(ctx);
    });
  });
});

// Обработчики статистики дня и недели
bot.action('daily_stats', async (ctx) => {
  const width = 800;
  const height = 600;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

  const dailyStats = await new Promise((resolve, reject) => {
    db.all(`SELECT t.name AS team_name, SUM(p.points) AS total_points
            FROM points p
            JOIN teams t ON p.team_id = t.id
            WHERE date(p.date) = date('now')
            GROUP BY t.name`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const labels = dailyStats.length ? dailyStats.map(row => row.team_name) : ['Нет данных'];
  const points = dailyStats.length ? dailyStats.map(row => row.total_points) : [0];
  const totalPoints = points.reduce((sum, val) => sum + val, 0);
  const percentages = dailyStats.length ? points.map(point => ((point / totalPoints) * 100).toFixed(2)) : [100];

  const chartConfig = {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        label: 'Баллы',
        data: percentages,
        backgroundColor: [
          'rgba(75, 192, 192, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(255, 206, 86, 0.2)',
          'rgba(231, 233, 237, 0.2)',
          'rgba(153, 102, 255, 0.2)'
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(231, 233, 237, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1
      }]
    }
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(chartConfig);
  await ctx.replyWithPhoto({ source: imageBuffer });

  const statsText = dailyStats.length
    ? dailyStats.map((row, index) => `Команда "${row.team_name}": ${row.total_points} баллов (${percentages[index]}%)`).join('\n')
    : 'Нет данных для отображения.';
  ctx.reply(`Дневная статистика по командам:\n${statsText}`);
  logAction(`User ${ctx.from.id} viewed daily team stats.`);
});

bot.action('weekly_stats', async (ctx) => {
  const width = 800;
  const height = 600;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

  const weeklyStats = await new Promise((resolve, reject) => {
    db.all(`SELECT t.name AS team_name, SUM(p.points) AS total_points
            FROM points p
            JOIN teams t ON p.team_id = t.id
            WHERE p.date >= date('now', '-7 days')
            GROUP BY t.name`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const labels = weeklyStats.length ? weeklyStats.map(row => row.team_name) : ['Нет данных'];
  const points = weeklyStats.length ? weeklyStats.map(row => row.total_points) : [0];
  const totalPoints = points.reduce((sum, val) => sum + val, 0);
  const percentages = weeklyStats.length ? points.map(point => ((point / totalPoints) * 100).toFixed(2)) : [100];

  const chartConfig = {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        label: 'Баллы',
        data: percentages,
        backgroundColor: [
          'rgba(75, 192, 192, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(255, 206, 86, 0.2)',
          'rgba(231, 233, 237, 0.2)',
          'rgba(153, 102, 255, 0.2)'
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(231, 233, 237, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1
      }]
    }
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(chartConfig);
  await ctx.replyWithPhoto({ source: imageBuffer });

  const statsText = weeklyStats.length
    ? weeklyStats.map((row, index) => `Команда "${row.team_name}": ${row.total_points} баллов (${percentages[index]}%)`).join('\n')
    : 'Нет данных для отображения.';
  ctx.reply(`Недельная статистика по командам:\n${statsText}`);
  logAction(`User ${ctx.from.id} viewed weekly team stats.`);
});

bot.action('total_stats', async (ctx) => {
  const width = 800;
  const height = 600;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

  const totalStats = await new Promise((resolve, reject) => {
    db.all(`SELECT t.name AS team_name, SUM(p.points) AS total_points
            FROM points p
            JOIN teams t ON p.team_id = t.id
            GROUP BY t.name`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const labels = totalStats.length ? totalStats.map(row => row.team_name) : ['Нет данных'];
  const points = totalStats.length ? totalStats.map(row => row.total_points) : [0];
  const totalPoints = points.reduce((sum, val) => sum + val, 0);
  const percentages = totalStats.length ? points.map(point => ((point / totalPoints) * 100).toFixed(2)) : [100];

  const chartConfig = {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        label: 'Баллы',
        data: percentages,
        backgroundColor: [
          'rgba(75, 192, 192, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(255, 206, 86, 0.2)',
          'rgba(231, 233, 237, 0.2)',
          'rgba(153, 102, 255, 0.2)'
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(231, 233, 237, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1
      }]
    }
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(chartConfig);
  await ctx.replyWithPhoto({ source: imageBuffer });

  const statsText = totalStats.length
    ? totalStats.map((row, index) => `Команда "${row.team_name}": ${row.total_points} баллов (${percentages[index]}%)`).join('\n')
    : 'Нет данных для отображения.';
  ctx.reply(`Общая статистика по командам:\n${statsText}`);
  logAction(`User ${ctx.from.id} viewed total team stats.`);
});

// Обработчик статистики по членам команды
bot.action('member_stats', async (ctx) => {
  const width = 800;
  const height = 600;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

  const memberStats = await new Promise((resolve, reject) => {
    db.all(`SELECT m.name AS member_name, SUM(p.points) AS total_points
            FROM points p
            JOIN members m ON p.member_id = m.id
            GROUP BY m.name`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const labels = memberStats.length ? memberStats.map(row => row.member_name) : ['Нет данных'];
  const points = memberStats.length ? memberStats.map(row => row.total_points) : [0];
  const totalPoints = points.reduce((sum, val) => sum + val, 0);
  const percentages = memberStats.length ? points.map(point => ((point / totalPoints) * 100).toFixed(2)) : [100];

  const chartConfig = {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        label: 'Баллы',
        data: percentages,
        backgroundColor: [
          'rgba(75, 192, 192, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(255, 206, 86, 0.2)',
          'rgba(231, 233, 237, 0.2)',
          'rgba(153, 102, 255, 0.2)'
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(231, 233, 237, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1
      }]
    }
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(chartConfig);
  await ctx.replyWithPhoto({ source: imageBuffer });

  const statsText = memberStats.length
    ? memberStats.map((row, index) => `Член команды "${row.member_name}": ${row.total_points} баллов (${percentages[index]}%)`).join('\n')
    : 'Нет данных для отображения.';
  ctx.reply(`Статистика по членам команды:\n${statsText}`);
  logAction(`User ${ctx.from.id} viewed member stats.`);
});

// 20 вариантов рекомендаций для лидеров и худших
const goodRecommendations = [
  "Отличная работа! Продолжайте в том же духе.",
  "Ваши усилия не остались незамеченными!",
  "Вы явно на верном пути, продолжайте развиваться!",
  "Командная работа на высшем уровне!",
  "Ваш вклад действительно ценится.",
  "Продолжайте поддерживать друг друга и добьетесь успеха.",
  "Ваше лидерство вдохновляет остальных.",
  "Прекрасный пример для подражания.",
  "Выделяйтесь своими уникальными способностями.",
  "С каждым днем вы становитесь лучше."
];

const badRecommendations = [
  "Не сдавайтесь, даже когда трудно.",
  "Используйте свои ошибки как возможности для роста.",
  "Обратите внимание на детали, они имеют значение.",
  "Постарайтесь наладить лучшее общение в команде.",
  "Работайте над своими слабыми сторонами.",
  "Слушайте идеи и мнения каждого участника.",
  "Не бойтесь пробовать что-то новое.",
  "Всегда будьте готовы учиться.",
  "Настройтесь на позитивный исход.",
  "Будьте настойчивыми и терпеливыми."
];

bot.action('recommendations', async (ctx) => {
  const userId = ctx.from.id;
  const userStats = await new Promise((resolve, reject) => {
    db.get('SELECT name, SUM(p.points) AS total_points FROM members m LEFT JOIN points p ON m.id = p.member_id WHERE m.id = ? GROUP BY m.name', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  const teamStats = await new Promise((resolve, reject) => {
    db.get('SELECT t.name, SUM(p.points) AS total_points FROM teams t LEFT JOIN points p ON t.id = p.team_id JOIN members m ON m.team_id = t.id WHERE m.id = ? GROUP BY t.name', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  const userRecommendation = userStats.total_points > 5 ? goodRecommendations : badRecommendations;
  const teamRecommendation = teamStats.total_points > 15 ? goodRecommendations : badRecommendations;

  const userRec = userRecommendation[Math.floor(Math.random() * userRecommendation.length)];
  const teamRec = teamRecommendation[Math.floor(Math.random() * teamRecommendation.length)];

  ctx.reply(`Рекомендации для вашей команды (${teamStats.name}):\n${teamRec}\n\nРекомендации для вас (${userStats.name}):\n${userRec}`);
  logAction(`User ${userId} viewed recommendations.`);
});

// Обработчики настроек
bot.action('create_team', (ctx) => {
  ctx.reply('Введите название новой команды:');
  bot.on('text', (ctx) => {
    const teamName = ctx.message.text;
    db.run('INSERT INTO teams (name) VALUES (?)', [teamName], (err) => {
      if (err) return console.error(err.message);
      ctx.reply(`Команда "${teamName}" успешно создана.`, Markup.inlineKeyboard([
        [Markup.button.callback('Назад', 'manager_menu')]
      ]));
      logAction(`Team ${teamName} created by user ${ctx.from.id}.`);
    });
  });
});

bot.action('edit_team', (ctx) => {
  db.all('SELECT id, name FROM teams', [], (err, rows) => {
    if (err) throw err;
    const buttons = rows.map(row => [Markup.button.callback(row.name, `select_team_${row.id}`)]);
    buttons.push([Markup.button.callback('Назад', 'manager_menu')]);
    ctx.reply('Выберите команду для редактирования:', Markup.inlineKeyboard(buttons));
  });
});

bot.action(/^select_team_(\d+)$/, (ctx) => {
  const teamId = ctx.match[1];
  db.all('SELECT name FROM members WHERE team_id IS NULL', [], (err, rows) => {
    if (err) return console.error(err.message);

    const memberButtons = rows.map(row => [Markup.button.callback(row.name, `add_member_${teamId}_${row.name}`)]);
    memberButtons.push([Markup.button.callback('Назад', 'manager_menu')]);
    ctx.reply('Выберите члена для добавления в команду:', Markup.inlineKeyboard(memberButtons));
  });
});

bot.action(/^add_member_(\d+)_(.+)$/, (ctx) => {
  const teamId = ctx.match[1];
  const memberName = ctx.match[2];
  
  db.run('UPDATE members SET team_id = ?, is_active = 1 WHERE name = ?', [teamId, memberName], (err) => {
    if (err) return console.error(err.message);
    ctx.reply(`Член команды "${memberName}" успешно добавлен в команду.`);
    logAction(`Member ${memberName} added to team ${teamId} by user ${ctx.from.id}.`);
  });
});

bot.action(/^edit_team_name_(\d+)$/, (ctx) => {
  const teamId = ctx.match[1];
  ctx.reply('Введите новое имя команды:');
  bot.on('text', (ctx) => {
    const newName = ctx.message.text;
    db.run('UPDATE teams SET name = ? WHERE id = ?', [newName, teamId], (err) => {
      if (err) return console.error(err.message);
      ctx.reply(`Название команды успешно изменено на "${newName}".`, Markup.inlineKeyboard([
        [Markup.button.callback('Назад', `select_team_${teamId}`)]
      ]));
      logAction(`Team ${teamId} renamed to ${newName} by user ${ctx.from.id}.`);
    });
  });
});

// Кнопка "Назад"
bot.action('back_to_main', (ctx) => {
  ctx.reply('Привет! Выберите действие:', Markup.inlineKeyboard([
    [Markup.button.callback('Меню проектного менеджера', 'manager_menu')],
    [Markup.button.callback('Психологический тест для оценки энергии', 'psychological_test')]
  ]));
});

// Планирование уведомлений
schedule.scheduleJob('0 9 * * *', () => {
  db.all(`SELECT id, name FROM members`, [], (err, rows) => {
    if (err) throw err;

    rows.forEach(member => {
      const message = `Доброе утро, ${member.name}! Не забудьте пройти психологический тест для оценки энергии.`;
      bot.telegram.sendMessage(member.id, message);
      logAction(`Sent morning reminder to ${member.id}.`);
    });
  });
});

// Запуск бота
bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
