console.group("4eDo script Bank checker & Posts counter; v 0.6");
console.log("%c~~ Скрипт для подсчёта постов пользователя и подготовки к отправке в банк. %c https://github.com/4eDo ~~", "font-weight: bold;", "font-weight: bold;");
console.groupEnd();

/* ----------------------------------------------------------- */
/* Хранение данных */
/* ----------------------------------------------------------- */
let userData_bcpc = {
  id: UserID,
  username: UserLogin,
  gamePosts: []
};

let bankData_bcpc = {
  allPosts: new Map(),
  userPosts: new Map()
};

let forumCache_bcpc = {
  topics: null,
  posts: new Map()
};

const mybb_bcpc = new MybbSDK(CONFIG_bcpc.BASE_URL + "/", {
  format: "json",
  charset: "utf-8"
});

/* ----------------------------------------------------------- */
/* РЕГУЛЯРКИ */
/* ----------------------------------------------------------- */
const REGEX_bcpc = {
  POST_ID: /\d+/g,
  TOPIC_URL: /viewtopic\.php\?id=(\d+)/g,
  HVMASK_BLOCK: /\[block=hvmask\][\s\S]*?\[\/block\]/g,
  URL_ID: /id=(\d+)/
};

/* ----------------------------------------------------------- */
/* ОСНОВНОЙ КОД */
/* ----------------------------------------------------------- */


/* ----------------------------------------------------------- */
/* ПОЛУЧЕНИЕ ДАННЫХ */
/* ----------------------------------------------------------- */

/**
 * Основная функция инициализации
 */
async function initUserPostAnalysis_bcpc() {
  const userIdInput = document.getElementById('userIdInput_bcpc').value.trim();
  let targetUserId = userIdInput;

  if (!targetUserId) {
    targetUserId = UserID;
  } else {
    targetUserId = parseInt(targetUserId, 10);
    if (isNaN(targetUserId)) {
      alert(TEMPLATES_bcpc.MESSAGES.INVALID_USER_ID);
      return;
    }
  }

  if (targetUserId !== UserID) {
    try {
      updateLoadingStatus_bcpc(TEMPLATES_bcpc.MESSAGES.LOADING_USER);
      const userResponse = await mybb_bcpc.call('users.get', {
        user_id: targetUserId,
        fields: ['user_id', 'username'],
        limit: 1
      });
      
      if (!userResponse.users || userResponse.users.length === 0) {
        alert(TEMPLATES_bcpc.MESSAGES.USER_NOT_FOUND);
        return;
      }

      userData_bcpc.id = userResponse.users[0].user_id;
      userData_bcpc.username = userResponse.users[0].username;
    } catch (error) {
      console.error("Ошибка загрузки данных пользователя:", error);
      alert(TEMPLATES_bcpc.MESSAGES.USER_LOAD_ERROR);
      return;
    }
  }

  document.getElementById('userInfo_bcpc').textContent = TEMPLATES_bcpc.POST_COUNTING_HEADER
	.replaceAll('{username}', userData_bcpc.username)
	.replaceAll('{uid}', userData_bcpc.id);
  
  document.getElementById('loading_bcpc').style.display = 'block';
  document.getElementById('results_bcpc').innerHTML = '';
  
  // Скрываем кнопки управления до завершения анализа
  document.getElementById('controlsTop_bcpc').style.display = 'none';
  document.getElementById('templateControls_bcpc').style.display = 'none';
  document.getElementById('togglePostsBtn_bcpc').style.display = 'none';
  
  try {
    await loadUserGamePosts_bcpc();
    await loadBankPosts_bcpc();
    await findUserBankPostsAndMentions_bcpc();
    renderResults_bcpc();
    
  } catch (error) {
    console.error("Ошибка подсчёта:", error);
    document.getElementById('results_bcpc').innerHTML = 
      `<div class="error">${TEMPLATES_bcpc.MESSAGES.ERROR.replace('{message}', error.message)}</div>`;
  } finally {
    document.getElementById('loading_bcpc').style.display = 'none';
  }
}


/**
 * Загрузка топиков с кэшем
 */
async function loadGameTopicsWithCache_bcpc() {
  if (forumCache_bcpc.topics) {
    console.log('Используем кэшированные топики');
    return forumCache_bcpc.topics;
  }
  
  console.log('Загружаем топики с сервера...');
  let allGameTopics = [];
  let skip = 0;
  let hasMore = true;
  
  while (hasMore) {
    const topicsResponse = await mybb_bcpc.call('topic.get', {
      forum_id: CONFIG_bcpc.GAME_FORUMS,
      fields: ['id', 'subject', 'forum_id', 'first_post_id', 'num_replies'],
      skip: skip,
      limit: CONFIG_bcpc.TOPICS_PER_REQUEST
    });
    
    if (!topicsResponse || topicsResponse.length === 0) {
      hasMore = false;
      break;
    }
    
    allGameTopics.push(...topicsResponse);
    skip += CONFIG_bcpc.TOPICS_PER_REQUEST;
    
    if (topicsResponse.length < CONFIG_bcpc.TOPICS_PER_REQUEST) {
      hasMore = false;
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  forumCache_bcpc.topics = allGameTopics;
  
  console.log(`Загружено ${allGameTopics.length} топиков (сохранено в кэш)`);
  return allGameTopics;
}
/**
 * Загрузка постов топика с кэшем
 */
async function getTopicPostsWithCache_bcpc(topicId, numReplies) {
  if (forumCache_bcpc.posts.has(topicId)) {
    console.log(`Используем кэшированные посты топика ${topicId}`);
    return forumCache_bcpc.posts.get(topicId);
  }
  
  const posts = await getAllPostsInTopic_bcpc(topicId, numReplies);
  
  forumCache_bcpc.posts.set(topicId, posts);
  console.log(`Посты топика ${topicId} сохранены в кэш (${posts.length} постов)`);
  
  return posts;
}

/**
 * Загрузка постов пользователя в игровых форумах
 */
async function loadUserGamePosts_bcpc() {
  try {
    updateLoadingStatus_bcpc(TEMPLATES_bcpc.MESSAGES.LOADING_TOPICS);
    
    const allGameTopics = await loadGameTopicsWithCache_bcpc();
    
    console.log(`Найдено ${allGameTopics.length} топиков в игровых форумах`);
    
    const userPosts = [];
    let processedTopics = 0;
    const totalTopics = allGameTopics.length;
    
    for (const topic of allGameTopics) {
      try {
        processedTopics++;
        updateLoadingStatus_bcpc(TEMPLATES_bcpc.MESSAGES.PROCESSING_TOPIC
          .replace('{current}', processedTopics)
          .replace('{total}', totalTopics));
        
        const allPostsInTopic = await getTopicPostsWithCache_bcpc(topic.id, topic.num_replies);
        
        if (allPostsInTopic && allPostsInTopic.length > 0) {
          const firstPost = allPostsInTopic[0];
          
          for (let i = 0; i < allPostsInTopic.length; i++) {
            const userPost = allPostsInTopic[i];
            if (userPost.user_id != userData_bcpc.id) continue;
            
            let is_first_post = false;
            let response_time = null;
            let response_time_str = '-';
            
            if (firstPost && userPost.id == firstPost.id) {
              is_first_post = true;
            } else if (CONFIG_bcpc.CHECK_RESPONSE_TIME && i > 1) {
              const prevUserPost = allPostsInTopic[i - 1];
              response_time = userPost.posted - prevUserPost.posted;
              
              if (response_time > 0 && response_time <= CONFIG_bcpc.RESPONSE_INTERVAL_HOURS * 3600) {
                response_time_str = formatTimeInterval_bcpc(response_time);
              } else {
                response_time = null;
              }
            }
            
            userPosts.push({
              ...userPost,
              forum_id: topic.forum_id,
              topic_subject: topic.subject,
              is_first_post: is_first_post,
              response_time: response_time,
              response_time_str: response_time_str
            });
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        console.error(`Ошибка обработки топика ${topic.id}:`, error);
      }
    }
    
    console.log(`Найдено ${userPosts.length} постов пользователя в играх`);
    
    userData_bcpc.gamePosts = userPosts.map(post => {
      const cleanText = stripHtmlTags_bcpc(post.message);
      return {
        id: post.id,
        topic_id: post.topic_id,
        forum_id: post.forum_id,
        subject: post.topic_subject,
        posted: post.posted,
        message: post.message,
        clean_text: cleanText,
        char_count: cleanText.length,
        bank_mentioned: false,
        bank_post_id: null,
        is_first_post: post.is_first_post,
        response_time: post.response_time,
        response_time_str: post.response_time_str
      };
    });
    
  } catch (error) {
    console.error("Ошибка загрузки игровых постов:", error);
    throw error;
  }
}


/**
 * Загрузка всех постов банка
 */
async function loadBankPosts_bcpc() {
  try {
    updateLoadingStatus_bcpc(TEMPLATES_bcpc.MESSAGES.LOADING_BANK);
    
    bankData_bcpc.allPosts.clear();
    let allBankPosts = [];
    let skip = 0;
    let hasMore = true;
    
    while (hasMore) {
      const postsResponse = await mybb_bcpc.call('post.get', {
        topic_id: CONFIG_bcpc.BANK_TOPICS,
        fields: ['id', 'message', 'posted', 'topic_id', 'username', 'user_id'],
        skip: skip,
        limit: CONFIG_bcpc.POSTS_PER_REQUEST
      });
      
      if (!postsResponse || postsResponse.length === 0) {
        hasMore = false;
        break;
      }
      
      allBankPosts.push(...postsResponse);
      skip += CONFIG_bcpc.POSTS_PER_REQUEST;
      
      updateLoadingStatus_bcpc(TEMPLATES_bcpc.MESSAGES.LOADED_BANK.replace('{count}', allBankPosts.length));
      
      if (postsResponse.length < CONFIG_bcpc.POSTS_PER_REQUEST) {
        hasMore = false;
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log(`Загружено ${allBankPosts.length} постов банка`);
    
    allBankPosts.forEach(post => {
      bankData_bcpc.allPosts.set(post.id, post);
    });
    
  } catch (error) {
    console.error("Ошибка загрузки постов банка:", error);
    throw error;
  }
}

/**
 * Поиск постов пользователя в банке и упоминаний игровых постов
 */
async function findUserBankPostsAndMentions_bcpc() {
  try {
    updateLoadingStatus_bcpc(TEMPLATES_bcpc.MESSAGES.SEARCHING_MENTIONS);
    
    bankData_bcpc.userPosts.clear();
    const userPostIds = new Set(userData_bcpc.gamePosts.map(post => post.id.toString()));
    const userTopicIds = new Set(userData_bcpc.gamePosts.map(post => post.topic_id.toString()));
    
    let foundMentions = 0;
    let foundUserPosts = 0;

    userData_bcpc.gamePosts.forEach(post => {
      post.bank_mentioned = false;
      post.bank_post_id = null;
    });

    for (const [bankPostId, bankPost] of bankData_bcpc.allPosts) {
      if (bankPostId <= 1) continue;
      
      if (bankPost.user_id == userData_bcpc.id) {
        bankData_bcpc.userPosts.set(bankPostId, bankPost);
        foundUserPosts++;
      }
      
      const postIdMatches = bankPost.message.match(REGEX_bcpc.POST_ID);
      if (postIdMatches) {
        for (const numberStr of postIdMatches) {
          if (userPostIds.has(numberStr)) {
            const userPost = userData_bcpc.gamePosts.find(post => post.id == numberStr);
            if (userPost) {
              userPost.bank_mentioned = true;
              userPost.bank_post_id = bankPostId;
              foundMentions++;
            }
          }
        }
      }
      
      const topicUrlMatches = bankPost.message.match(REGEX_bcpc.TOPIC_URL);
      if (topicUrlMatches) {
        for (const urlMatch of topicUrlMatches) {
          const topicIdMatch = urlMatch.match(REGEX_bcpc.URL_ID);
          if (topicIdMatch && topicIdMatch[1]) {
            const topicId = topicIdMatch[1];
            if (userTopicIds.has(topicId)) {
              const userPostsInTopic = userData_bcpc.gamePosts.filter(post => 
                post.topic_id == topicId && post.is_first_post
              );
              
              for (const userPost of userPostsInTopic) {
                if (!userPost.bank_mentioned) {
                  userPost.bank_mentioned = true;
                  userPost.bank_post_id = bankPostId;
                  foundMentions++;
                }
              }
            }
          }
        }
      }
      
      const directTopicMatches = bankPost.message.match(REGEX_bcpc.TOPIC_URL);
      if (directTopicMatches) {
        for (const urlMatch of directTopicMatches) {
          const topicIdMatch = urlMatch.match(REGEX_bcpc.URL_ID);
          if (topicIdMatch && topicIdMatch[1]) {
            const topicId = topicIdMatch[1];
            if (userTopicIds.has(topicId)) {
              const userPostsInTopic = userData_bcpc.gamePosts.filter(post => 
                post.topic_id == topicId && post.is_first_post
              );
              
              for (const userPost of userPostsInTopic) {
                if (!userPost.bank_mentioned) {
                  userPost.bank_mentioned = true;
                  userPost.bank_post_id = bankPostId;
                  foundMentions++;
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`Найдено ${foundUserPosts} постов пользователя в банке`);
    console.log(`Найдено ${foundMentions} упоминаний в банке`);
    
  } catch (error) {
    console.error("Ошибка поиска:", error);
    throw error;
  }
}

/**
 * Очистка HTML от тегов для подсчета символов
 */
function stripHtmlTags_bcpc(html) {
  html = html.replace(REGEX_bcpc.HVMASK_BLOCK, '');
  
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  
  const elementsToRemove = tmp.querySelectorAll('code, pre, .codebox, script, style');
  elementsToRemove.forEach(el => el.remove());
  
  const text = tmp.textContent || tmp.innerText || '';
  return text.replace(/\s+/g, ' ').trim();
}

/* ----------------------------------------------------------- */
/* UI */
/* ----------------------------------------------------------- */

/**
 * Обновление статуса загрузки
 */
function updateLoadingStatus_bcpc(message) {
  const statusElement = document.getElementById('loadingStatus_bcpc');
  if (statusElement) {
    statusElement.textContent = message;
  }
}

/**
 * Форматирование временного интервала
 */
function formatTimeInterval_bcpc(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  let result = [];
  if (days > 0) result.push(`${days}д`);
  if (hours > 0) result.push(`${hours}ч`);
  if (minutes > 0) result.push(`${minutes}м`);
  if (secs > 0 || result.length === 0) result.push(`${secs}с`);
  
  return result.join(' ');
}

/**
 * Генерация URL для поста
 */
function generatePostUrl_bcpc(postId, topicId = null) {
  if (topicId) {
    return `${CONFIG_bcpc.BASE_URL}/viewtopic.php?id=${topicId}#p${postId}`;
  }
  return `${CONFIG_bcpc.BASE_URL}/viewtopic.php?pid=${postId}#p${postId}`;
}

/**
 * Форматирование дата
 */
function formatDate_bcpc(timestamp) {
  return new Date(timestamp * 1000).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Сокращение текста до максимальной длины
 */
function truncateText_bcpc(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Генерация строки для открытия темы в банке
 */
function generateOpeningLine_bcpc(post, index) {
  const topicUrl = `${CONFIG_bcpc.BASE_URL}/viewtopic.php?id=${post.topic_id}`;
  
  return TEMPLATES_bcpc.BANK_FORMATS.OPENING_LINE
    .replace('{{number}}', index + 1)
    .replace('{{topic_url}}', topicUrl)
    .replace('{{subject}}', post.subject);
}

/**
 * Генерация строки для игрового поста в банке
 */
function generateGameLine_bcpc(post, index) {
  const postUrl = generatePostUrl_bcpc(post.id, post.topic_id);
  
  let responseInfo = '';
  if (CONFIG_bcpc.CHECK_RESPONSE_TIME && post.response_time && post.response_time > 0) {
    responseInfo = TEMPLATES_bcpc.BANK_FORMATS.GAME_LINE_WITH_RESPONSE
      .replace('{{response_text}}', TEMPLATES_bcpc.BANK_FORMATS.RESPONSE_TEXT
        .replace('{{response_time}}', post.response_time_str));
  }
  
  return TEMPLATES_bcpc.BANK_FORMATS.GAME_LINE
    .replace('{{number}}', index + 1)
    .replace('{{post_url}}', postUrl)
    .replace('{{subject}}', post.subject)
    .replace('{{char_count}}', post.char_count)
    .replace('{{response_info}}', responseInfo);
}

/**
 * Генерация шаблона для банка
 */
function generateBankTemplate_bcpc(unclaimedPosts, sortBy = 'date') {
  const openingPosts = unclaimedPosts.filter(post => post.is_first_post);
  let gamePosts = unclaimedPosts.filter(post => !post.is_first_post);
  
  if (sortBy === 'date') {
    gamePosts = gamePosts.sort((a, b) => a.posted - b.posted);
  } else if (sortBy === 'length') {
    gamePosts = gamePosts.sort((a, b) => b.char_count - a.char_count);
  }
  
  let openingSection = '';
  if (openingPosts.length > 0) {
    const openingList = openingPosts.map((post, index) => 
      generateOpeningLine_bcpc(post, index)
    ).join('\n');
    
    openingSection = TEMPLATES_bcpc.OPENING_SECTION
      .replace('{{opening_list}}', openingList);
  }
  
  let gameSection = '';
  if (gamePosts.length > 0) {
    const gameList = gamePosts.map((post, index) => 
      generateGameLine_bcpc(post, index)
    ).join('\n');
    
    gameSection = TEMPLATES_bcpc.GAME_SECTION
      .replace('{{game_list}}', gameList);
  }
  
  const totalGamePosts = gamePosts.length;
  const totalGameChars = gamePosts.reduce((sum, post) => sum + post.char_count, 0);
  
  return TEMPLATES_bcpc.BANK_TEMPLATE
    .replace('{{opening_posts}}', openingSection)
    .replace('{{game_posts}}', gameSection)
    .replace('{{total_game_posts}}', totalGamePosts)
    .replace('{{total_game_chars}}', totalGameChars.toLocaleString());
}

/**
 * Переключение видимости учтенных постов
 */
function togglePostsVisibility_bcpc() {
  const table = document.querySelector('.bank-checker-table');
  if (!table) return;
  
  const toggleButton = document.getElementById('togglePostsBtn_bcpc');
  const showAll = toggleButton.textContent.includes(TEMPLATES_bcpc.BUTTONS.HIDE_CLAIMED);
  
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(row => {
    if (row.classList.contains('claimed_bcpc')) {
      row.style.display = showAll ? 'none' : '';
    }
  });
  
  toggleButton.textContent = showAll ? TEMPLATES_bcpc.BUTTONS.SHOW_ALL : TEMPLATES_bcpc.BUTTONS.HIDE_CLAIMED;
}

/**
 * Генерация шаблона по дате
 */
function generateTemplateByDate_bcpc() {
  const unclaimedPosts = userData_bcpc.gamePosts.filter(post => !post.bank_mentioned);
  if (unclaimedPosts.length === 0) {
    alert(TEMPLATES_bcpc.MESSAGES.NO_UNCLAIMED_POSTS);
    return;
  }
  
  const template = generateBankTemplate_bcpc(unclaimedPosts, 'date');
  showTemplate_bcpc(template, 'по дате');
}

/**
 * Генерация шаблона по длине
 */
function generateTemplateByLength_bcpc() {
  const unclaimedPosts = userData_bcpc.gamePosts.filter(post => !post.bank_mentioned);
  if (unclaimedPosts.length === 0) {
    alert(TEMPLATES_bcpc.MESSAGES.NO_UNCLAIMED_POSTS);
    return;
  }
  
  const template = generateBankTemplate_bcpc(unclaimedPosts, 'length');
  showTemplate_bcpc(template, 'по длине');
}

/**
 * Скрытие шаблона
 */
function hideTemplate_bcpc() {
  document.getElementById('bank-template_bcpc').innerHTML = '';
}

/**
 * Показать шаблон в текстовом поле
 */
function showTemplate_bcpc(template, sortType) {
  const textarea = document.createElement('textarea');
  textarea.value = template;
  textarea.style.width = '100%';
  textarea.style.height = '300px';
  textarea.style.marginTop = '10px';
  textarea.style.fontFamily = 'monospace';
  
  const container = document.getElementById('bank-template_bcpc');
  container.innerHTML = `<h4>${TEMPLATES_bcpc.TEMPLATE_HEADERS.BANK_TEMPLATE.replace('{sortType}', sortType)}</h4>`;
  container.appendChild(textarea);
  container.appendChild(document.createElement('br'));
  
  const copyButton = document.createElement('button');
  copyButton.textContent = TEMPLATES_bcpc.BUTTONS.COPY;
  copyButton.classList.add('button');
  copyButton.addEventListener('click', () => {
    textarea.select();
    document.execCommand('copy');
    alert(TEMPLATES_bcpc.MESSAGES.COPIED);
  });
  
  container.appendChild(copyButton);
}

/**
 * Отображение результатов
 */
function renderResults_bcpc() {
  const resultsContainer = document.getElementById('results_bcpc');
  resultsContainer.innerHTML = '';
  
  if (userData_bcpc.gamePosts.length === 0) {
    resultsContainer.innerHTML = `<div class="no-posts">${TEMPLATES_bcpc.MESSAGES.NO_POSTS}</div>`;
    return;
  }
  
  const sortedPosts = [...userData_bcpc.gamePosts].sort((a, b) => a.posted - b.posted);
  const claimedPosts = sortedPosts.filter(post => post.bank_mentioned);
  const unclaimedPosts = sortedPosts.filter(post => !post.bank_mentioned);
  
  let lastBankVisit = null;
  if (bankData_bcpc.userPosts.size > 0) {
    const userBankPosts = Array.from(bankData_bcpc.userPosts.values());
    userBankPosts.sort((a, b) => b.posted - a.posted);
    lastBankVisit = userBankPosts[0];
  }
  
  const allOpeningPosts = sortedPosts.filter(post => post.is_first_post);
  const allGamePosts = sortedPosts.filter(post => !post.is_first_post);
  
  const claimedOpeningPosts = claimedPosts.filter(post => post.is_first_post);
  const claimedGamePosts = claimedPosts.filter(post => !post.is_first_post);
  
  const unclaimedOpeningPosts = unclaimedPosts.filter(post => post.is_first_post);
  const unclaimedGamePosts = unclaimedPosts.filter(post => !post.is_first_post);
  
  const allResponsePosts = allGamePosts.filter(post => 
    CONFIG_bcpc.CHECK_RESPONSE_TIME && 
    post.response_time && 
    post.response_time > 0 &&
    post.response_time <= CONFIG_bcpc.RESPONSE_INTERVAL_HOURS * 3600
  );
  
  const claimedResponsePosts = claimedGamePosts.filter(post => 
    CONFIG_bcpc.CHECK_RESPONSE_TIME && 
    post.response_time && 
    post.response_time > 0 &&
    post.response_time <= CONFIG_bcpc.RESPONSE_INTERVAL_HOURS * 3600
  );
  
  const unclaimedResponsePosts = unclaimedGamePosts.filter(post => 
    CONFIG_bcpc.CHECK_RESPONSE_TIME && 
    post.response_time && 
    post.response_time > 0 &&
    post.response_time <= CONFIG_bcpc.RESPONSE_INTERVAL_HOURS * 3600
  );
  
  const totalGameChars = allGamePosts.reduce((sum, post) => sum + post.char_count, 0);
  const claimedGameChars = claimedGamePosts.reduce((sum, post) => sum + post.char_count, 0);
  const unclaimedGameChars = unclaimedGamePosts.reduce((sum, post) => sum + post.char_count, 0);
  
  const statsHtml = TEMPLATES_bcpc.STATS
    .replace('{{total_posts}}', allGamePosts.length)
    .replace('{{total_chars}}', totalGameChars.toLocaleString())
    .replace('{{total_openings}}', allOpeningPosts.length)
    .replace('{{total_responses}}', allResponsePosts.length)
    .replace('{{claimed_posts}}', claimedGamePosts.length)
    .replace('{{claimed_chars}}', claimedGameChars.toLocaleString())
    .replace('{{claimed_openings}}', claimedOpeningPosts.length)
    .replace('{{claimed_responses}}', claimedResponsePosts.length)
    .replace('{{unclaimed_posts}}', unclaimedGamePosts.length)
    .replace('{{unclaimed_chars}}', unclaimedGameChars.toLocaleString())
    .replace('{{unclaimed_openings}}', unclaimedOpeningPosts.length)
    .replace('{{unclaimed_responses}}', unclaimedResponsePosts.length);
  
  const statsDiv = document.createElement('div');
  statsDiv.className = 'stats_bcpc';
  statsDiv.innerHTML = statsHtml;
  
  if (lastBankVisit) {
    const lastVisitDate = formatDate_bcpc(lastBankVisit.posted);
    const lastVisitUrl = generatePostUrl_bcpc(lastBankVisit.id);
    
    const visitHtml = TEMPLATES_bcpc.LAST_VISIT
      .replace('{{visit_url}}', lastVisitUrl)
      .replace('{{visit_date}}', lastVisitDate);
    
    statsDiv.innerHTML += visitHtml;
  }
  
  resultsContainer.appendChild(statsDiv);
  
  const table = document.createElement('table');
  table.className = 'bank-checker-table';
  
  let tableRows = '';
  sortedPosts.forEach((post, index) => {
    const rowClass = `${post.bank_mentioned ? 'claimed_bcpc' : 'unclaimed_bcpc'} ${post.is_first_post ? 'first-post_bcpc' : ''}`;
    const postUrl = generatePostUrl_bcpc(post.id, post.topic_id);
    const bankUrl = post.bank_mentioned ? generatePostUrl_bcpc(post.bank_post_id) : '';
    const shortSubject = truncateText_bcpc(post.subject, CONFIG_bcpc.SUBJECT_MAX_LENGTH);
    
    const rowHtml = TEMPLATES_bcpc.TABLE_ROW
      .replace('{{row_class}}', rowClass)
      .replace('{{row_number}}', index + 1)
      .replace('{{post_date}}', formatDate_bcpc(post.posted))
      .replace('{{post_subject}}', post.subject)
      .replace('{{post_subject_short}}', shortSubject)
      .replace('{{post_url}}', postUrl)
      .replace('{{post_id}}', post.id)
      .replace('{{char_count}}', post.is_first_post ? '-' : post.char_count.toLocaleString())
      .replace('{{response_time}}', post.response_time_str)
      .replace('{{post_type}}', post.is_first_post ? TEMPLATES_bcpc.POST_TYPES.OPENING : TEMPLATES_bcpc.POST_TYPES.RESPONSE)
      .replace('{{status_icon}}', post.bank_mentioned ? '✓' : '✗')
      .replace('{{bank_reference}}', post.bank_mentioned ? 
        `<a href="${bankUrl}" target="_blank" title="${CONFIG_bcpc.BANK_TOPIC_NAME}">${CONFIG_bcpc.BANK_TOPIC_NAME}</a>` : 
        '—');
    
    tableRows += rowHtml;
  });
  
  table.innerHTML = TEMPLATES_bcpc.TABLE_HEAD + ` <tbody>${tableRows}</tbody> `;
  
  resultsContainer.appendChild(table);
  
  // Показываем кнопки управления
  document.getElementById('controlsTop_bcpc').style.display = 'flex';
  document.getElementById('togglePostsBtn_bcpc').style.display = '';
  document.getElementById('togglePostsBtn_bcpc').textContent = TEMPLATES_bcpc.BUTTONS.HIDE_CLAIMED;
  
  // Показываем кнопки шаблонов, если есть неучтенные посты
  if (unclaimedPosts.length > 0) {
    document.getElementById('templateControls_bcpc').style.display = 'flex';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const userIdInput = document.getElementById('userIdInput_bcpc');
  if (userIdInput && UserID) {
    userIdInput.value = UserID;
  }
});
