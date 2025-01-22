/* В каких форумах ищем */
const TARGET_FORUMS = {
  "findRole": 31,
  "findPlayer": 32
};

console.group("Для Маяка от 4eDo");
console.log("%c~~ Скрипт для автоматического ведения каталога заявок. %c https://github.com/4eDo ~~", "font-weight: bold;", "font-weight: bold;");
console.log("v0.19");
console.groupEnd();
/**
 * Выгрузка данных по темам
 */
const TOPICS_PER_REQUEST = 100;
const POSTS_PER_REQUEST = 100;
var results;
const addonParsers_bb = {
  catFandomIncl: /\[catFandomIncl\](.*?)\[\/catFandomIncl\]/,
  catFandomExcl: /\[catFandomExcl\](.*?)\[\/catFandomExcl\]/,
  catSettingIncl: /\[catSettingIncl\](.*?)\[\/catSettingIncl\]/,
  catSettingExcl: /\[catSettingExcl\](.*?)\[\/catSettingExcl\]/,
  catSex: /\[catSex\](.*?)\[\/catSex\]/,
  catRelationsIncl: /\[catRelationsIncl\](.*?)\[\/catRelationsIncl\]/,
  catRelationsExcl: /\[catRelationsExcl\](.*?)\[\/catRelationsExcl\]/,
  catAgeFrom: /\[catAgeFrom\](.*?)\[\/catAgeFrom\]/,
  catAgeTo: /\[catAgeTo\](.*?)\[\/catAgeTo\]/,
  catTagsIncl: /\[catTagsIncl\](.*?)\[\/catTagsIncl\]/,
  catTagsExcl: /\[catTagsExcl\](.*?)\[\/catTagsExcl\]/
};
const singleValueAddons = ["catSex", "catAgeFrom", "catAgeTo"];
function parseAddons(message) {
  const addons = {
    fandom: { include: null, exclude: null },
    setting: { include: null, exclude: null },
    relations: { include: null, exclude: null },
    age: { from: 0, to: 0 },
    tags: { include: null, exclude: null },
    sex: null
  };
  let hasMatch = false;
  for (const addonName in addonParsers_bb) {
    const match = message.match(addonParsers_bb[addonName]);
    let content;
    if (match) {
      content = match[1];
    } else {
      content = extractTextUsingDOMParser(message, addonName);
    }
    if(content) {
      let addonValue = singleValueAddons.includes(addonName) ? content : content.split(", ");
      switch(addonName) {
        case "catFandomIncl": addons["fandom"]["include"] = addonValue; break;
        case "catFandomExcl": addons["fandom"]["exclude"] = addonValue; break;
        case "catSettingIncl": addons["setting"]["include"] = addonValue; break;
        case "catSettingExcl": addons["setting"]["exclude"] = addonValue; break;
        case "catSex": addons["sex"] = addonValue; break;
        case "catRelationsIncl": addons["relations"]["include"] = addonValue; break;
        case "catRelationsExcl": addons["relations"]["exclude"] = addonValue; break;
        case "catAgeFrom": addons["age"]["from"] = addonValue; break;
        case "catAgeTo": addons["age"]["to"] = addonValue; break;
        case "catTagsIncl": addons["tags"]["include"] = addonValue; break;
        case "catTagsExcl": addons["tags"]["exclude"] = addonValue; break;
      }
      hasMatch = true;
    }
  }
  return hasMatch ? addons : false;
}
function extractTextUsingDOMParser(html, tagName) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const elements = doc.querySelectorAll(`.custom_tag_${tagName}`);

  if (elements.length === 0) {
    return null; // Ничего не найдено
  }

  let extractedText = "";
  for (let i = 0; i < elements.length; i++) {
      extractedText += elements[i].textContent.trim();
  }
  return extractedText;
}

async function fetchData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

async function getTopics(forumIds) {
  const url = `/api.php?method=topic.get&forum_id=${forumIds.join(',')}&fields=id,subject,first_post&limit=${TOPICS_PER_REQUEST}`;
  const data = await fetchData(url);
  return data?.response || [];
}

async function getPosts(topicIds) {
  if (!topicIds || topicIds.length === 0) return [];

  let skip = 0;
  let allPosts = [];
  while (true) {
    const url = `/api.php?method=post.get&topic_id=${topicIds.join(',')}&fields=id,username,user_id,message,topic_id&limit=${POSTS_PER_REQUEST}&skip=${skip}&sort_by=id&sort_dir=asc`;
    const data = await fetchData(url);
    if (!data?.response) break;
    allPosts.push(...data.response);
    if (data.response.length < POSTS_PER_REQUEST) break;
    skip += POSTS_PER_REQUEST;
  }
  return allPosts;
}

async function processForum(forumId, marker) {
  const topics = await getTopics([forumId]);
  const topicIds = topics.map(topic => topic.id);
  const posts = await getPosts(topicIds);

  const processedTopics = topics.map(topic => ({
    tid: topic.id,
    first_post: topic.first_post ? topic.first_post : 0,
    subject: topic.subject,
    marker: marker,
    fandom: {
      include: [],
      exclude: []
    },
    setting: {
      include: [],
      exclude: []
    },
    sex: "",
    relations: {
      include: [],
      exclude: []
    },
    age: {
      from: 0,
      to: 0
    },
    tags: {
      include: [],
      exclude: []
    },
    author: "",
    hasSddons: false
  }));

  const topicIndexMap = Object.fromEntries(processedTopics.map((topic, index) => [topic.tid, index]));

  for (const post of posts) {
    const topicIndex = topicIndexMap[post.topic_id];
    if (topicIndex !== undefined) {
      processedTopics[topicIndex].author = post.username;
      processedTopics[topicIndex].author_id = post.user_id;
      const correctFirstPost = processedTopics[topicIndex].first_post != 0 && processedTopics[topicIndex].first_post < post.id;
      if (post.id === processedTopics[topicIndex].first_post || !correctFirstPost) {
        const addons = parseAddons(post.message);
        if (addons) {
          processedTopics[topicIndex].hasAddons = true;
          processedTopics[topicIndex] = { ...processedTopics[topicIndex], ...addons };
        }
        if (!correctFirstPost) {
          processedTopics[topicIndex].first_post = post.id;
        }
      }
    } else {
      console.error("Тема не найдена для поста:", post);
    }
  }

  return processedTopics;
}



/**
 * Отрисовка страницы
 */
function renderCatalog(data, sortBy) {
  const catalogBox = $("#catalog-box");
  catalogBox.empty();

  const sortedTickets = {};
  const unspecifiedTickets = {};

  data.forEach((ticket) => {
    let hasValue = false;

    const processCategory = (category, field) => {
      if (ticket[category] && ticket[category][field] && ticket[category][field].length > 0) {
          hasValue = true;
          ticket[category][field].forEach(value => {
            if (value) {
              sortedTickets[value] = sortedTickets[value] || [];
              sortedTickets[value].push(ticket);
            }
          });
      }
    };

    switch (sortBy) {
      case "fandom":
        processCategory("fandom", "include");
        break;
      case "setting":
        processCategory("setting", "include");
        break;
      case "relations":
        processCategory("relations", "include");
        break;
      case "tags":
        processCategory("tags", "include");
        break;
      case "sex":
        if (ticket.sex) {
          hasValue = true;
          sortedTickets[ticket.sex] = sortedTickets[ticket.sex] || [];
          sortedTickets[ticket.sex].push(ticket);
        }
        break;
    }

    if (!hasValue) {
      unspecifiedTickets[sortBy] = unspecifiedTickets[sortBy] || [];
      unspecifiedTickets[sortBy].push(ticket);
    }

  });

  for (const key in sortedTickets) {
    sortedTickets[key].sort((a, b) => a.subject.localeCompare(b.subject));
  }

  for (const key in unspecifiedTickets) {
    unspecifiedTickets[key].sort((a, b) => a.subject.localeCompare(b.subject));
    sortedTickets["Не указано"] = sortedTickets["Не указано"] || [];
    sortedTickets["Не указано"].push(...unspecifiedTickets[key]);
  }

  const sortedKeys = Object.keys(sortedTickets)
    .sort((a, b) => {
      if (a === "Не указано") return 1;
      if (b === "Не указано") return -1;
      return a.localeCompare(b);
    });


  for (const key of sortedKeys) {
    const list = $('<div class="catalog-list"></div>');
    const title = $('<div class="catalog-title container"></div>').text(key);
    const ul = $("<ul></ul>");

    sortedTickets[key].forEach((ticket) => {
      const li = $(`<li class="ticket ${ticket.marker} ticket-${ticket.tid} ${ticket.author_id == UserID ? 'ticket-your' : ''}"></li>`);
      const a = $(`<details>
        <summary>${ticket.author_id == UserID ? 'Ваша заявка' : 'Заявка'} "<a class="item-subj" href="/viewtopic.php?id=${ticket.tid}">${ticket.subject}</a>"</summary>
        <blockdetails>
          <p><span class="label">Автор заявки:</span> ${ticket.author}</p>
          <div class="p_categories ${ticket.hasAddons ? '' : 'hidden'}">
          	<div class="p_fandom">
          		<p><strong>ФАНДОМЫ</strong>
          			<br><span class="custom_tag_catFandomIncl">${ticket.fandom.include ? ticket.fandom.include.join(", ") : ""}</span>
          			<br><span class="custom_tag_catFandomExcl">${ticket.fandom.exclude ? ticket.fandom.exclude.join(", ") : ""}</span></p>
          	</div>
          	<div class="p_setting">
          		<p><strong>СЕТТИНГИ</strong>
          			<br><span class="custom_tag_catSettingIncl">${ticket.setting.include ? ticket.setting.include.join(", ") : ""}</span>
          			<br><span class="custom_tag_catSettingExcl">${ticket.setting.exclude ? ticket.setting.exclude.join(", ") : ""}</span></p>
          	</div>
          	<div class="p_age">
          		<p><strong>ВОЗРАСТ</strong>
          			<br><span class="custom_tag_catAgeFrom">${ticket.age.from != 0 ? ticket.age.from : ""}</span> - <span class="custom_tag_catAgeTo">${ticket.age.to != 0 ? ticket.age.to : ""}</span></p>
          	</div>
          	<div class="p_tag">
          		<p><strong>МЕТКИ</strong>
          			<br><span class="custom_tag_catTagsIncl">${ticket.tags.include ? ticket.tags.include.join(", ") : ""}</span>
          			<br><span class="custom_tag_catTagsExcl">${ticket.tags.exclude ? ticket.tags.exclude.join(", ") : ""}</span></p>
          	</div>
          	<div class="p_sex">
          		<p><strong>ПОЛ</strong>
          			<br><span class="custom_tag_catSex">${ticket.sex ? ticket.sex : ""}</span></p>
          	</div>
          	<div class="p_relation">
          		<p><strong>ТИП ОТНОШЕНИЙ</strong>
          			<br><span class="custom_tag_catRelationsIncl">${ticket.relations.include ? ticket.relations.include.join(", ") : ""}</span>
          			<br><span class="custom_tag_catRelationsExcl">${ticket.relations.exclude ? ticket.relations.exclude.join(", ") : ""}</span></p>
          	</div>
          </div>
        </blockdetails>
      </details>`);
      li.append(a);
      ul.append(li);
    });
    list.append(title, ul);
    catalogBox.append(list);
  }
  populateDatalists(data);
}

function populateDatalists(data) {
  const fandomSet = new Set();
  const settingSet = new Set();
  const sexSet = new Set();
  const relationsSet = new Set();
  const tagsSet = new Set();

  data.forEach(ticket => {
    if (ticket.fandom.include) ticket.fandom.include.forEach(f => fandomSet.add(f));
    if (ticket.setting.include) ticket.setting.include.forEach(s => settingSet.add(s));
    if (ticket.sex) sexSet.add(ticket.sex);
    if (ticket.relations.include) ticket.relations.include.forEach(r => relationsSet.add(r));
    if (ticket.tags.include) ticket.tags.include.forEach(t => tagsSet.add(t));
  });

  populateDatalist("fandomList", Array.from(fandomSet));
  populateDatalist("settingList", Array.from(settingSet));
  populateDatalist("sexList", Array.from(sexSet));
  populateDatalist("relationsList", Array.from(relationsSet));
  populateDatalist("tagsList", Array.from(tagsSet));
}

function populateDatalist(listId, items) {
  const datalist = document.getElementById(listId);
  datalist.innerHTML = "";
  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item;
    datalist.appendChild(option);
  });
}


function handleTypeChange() {
  switch (document.getElementById('searchInput_type').value) {
    case "all":
      $(".findRole").show();
      $(".findPlayer").show();
      break;
    case "findRole":
      $(".findRole").show();
      $(".findPlayer").hide();
      break;
    case "findPlayer":
      $(".findRole").hide();
      $(".findPlayer").show();
      break;
  };
  $('.catalog-list').each(function () {
    const catalogList = $(this);
    catalogList.show();
    const visibleTickets = catalogList.find('.ticket:visible');
    if (visibleTickets.length === 0) {
      catalogList.hide();
    }
  });
}

function searchInBlocks() {
  const fandom = document.getElementById('searchInput_fandom').value.toLowerCase();
  const setting = document.getElementById('searchInput_setting').value.toLowerCase();
  const sex = document.getElementById('searchInput_sex').value.toLowerCase();
  const relations = document.getElementById('searchInput_relations').value.toLowerCase();
  const tags = document.getElementById('searchInput_tags').value.toLowerCase();

  results.forEach(ticket => {
    const details = document.querySelectorAll(`.ticket-${ticket.tid}`);
    if (!details) return;
    
    const isBad = (value, excludeList) => excludeList.some(excludeItem => value.toLowerCase().includes(excludeItem.toLowerCase()));

    const matchesFandom = !fandom || (ticket.fandom.include.some(item => item.toLowerCase().includes(fandom)) && !isBad(fandom, ticket.fandom.exclude));
    const matchesSetting = !setting || (ticket.setting.include.some(item => item.toLowerCase().includes(setting)) && !isBad(setting, ticket.setting.exclude));
    const matchesSex = !sex || ticket.sex.toLowerCase().includes(sex);
    const matchesRelations = !relations || (ticket.relations.include.some(item => item.toLowerCase().includes(relations)) && !isBad(relations, ticket.relations.exclude));
    const matchesTags = !tags || (ticket.tags.include.some(item => item.toLowerCase().includes(tags)) && !isBad(tags, ticket.tags.exclude));

    
    details.forEach(detail => {
      detail.classList.remove('success', 'bad', 'notFound');
      if (!fandom && !setting && !sex && !relations && !tags) {
        // Ничего не делаем
      } else if (isBad(fandom, ticket.fandom.exclude) || isBad(setting, ticket.setting.exclude) || isBad(relations, ticket.relations.exclude) || isBad(tags, ticket.tags.exclude)) {
        detail.classList.add('bad');
      } else if (matchesFandom && matchesSetting && matchesSex && matchesRelations && matchesTags) {
        detail.classList.add('success');
      } else {
        detail.classList.add('notFound');
      }
    });
  });
}

function resetFilters() {
  document.getElementById('searchInput_fandom').value = '';
  document.getElementById('searchInput_setting').value = '';
  document.getElementById('searchInput_sex').value = '';
  document.getElementById('searchInput_relations').value = '';
  document.getElementById('searchInput_tags').value = '';

  const detailsElements = document.querySelectorAll('.ticket');
  detailsElements.forEach(details => {
    details.classList.remove('success', 'bad', 'notFound');
  });
}


async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const searchMode = urlParams.get('searchMode') ? urlParams.get('searchMode') : "all";

  const promises = Object.entries(TARGET_FORUMS).map(([marker, forumId]) =>
    processForum(forumId, marker)
  );

  const splitedResults = await Promise.all(promises);
  results = splitedResults.flat();
  console.log(results);

  document.getElementById('searchInput_type').value = searchMode;

  renderCatalog(results, "fandom");
  handleTypeChange();
  
  $("body").on("click", ".sort-button", function () {
    $(".sort-button").removeClass("isactive");
    $(this).addClass("isactive");
    const sortBy = $(this).data("sort");
    renderCatalog(results, sortBy);
    handleTypeChange();
    searchInBlocks();
  });

  document.getElementById('searchInput_type').addEventListener('change', handleTypeChange);

  $(".searchInput").keydown(function(event) {
    if (event.keyCode === 13) {
      event.preventDefault();
      searchInBlocks();
    }
  });
}
init();
