console.group("4eDo script auto_check_forum_and_gaming_activity ");
console.log("%c~~ Скрипт для автоматической проверки отсутствия игровой активности. %c https://github.com/4eDo ~~", "font-weight: bold;", "font-weight: bold;");
console.log("More info: https://github.com/4eDo/mybb/tree/main/auto_check_forum_and_gaming_activity# ");
console.groupEnd();

if (FORUMS_WITH_POSTS && TOPICS_WITH_DAY_OFF && INTERVAL_ANY_POST && INTERVAL_GAME_POST && INTERVAL_DAY_OFF_POST) {
	$('#result_4eDo')
		.append(`
          <h2>Отсутствие любой активности более ${INTERVAL_ANY_POST} д.</h2>
          <ul id="usersWithoutAnyPosts"></ul>
        `);
	$('#result_4eDo')
		.append(`
          <h2>Отсутствие игровой активности более ${INTERVAL_GAME_POST} д.</h2>
		  <p><i>Создание эпизода скрипт считает постом.</i></p>
          <ul id="usersWithoutGamePosts"></ul>
        `);
	$('#result_4eDo')
		.append(`
          <h2>Были сообщения в теме отсутствий за последние ${INTERVAL_DAY_OFF_POST} д.</h2>
          <ul id="usersWithDayOff"></ul>
        `);
	$('#result_4eDo')
		.append(`<br>
          <h2>Ошибки в процессе сбора информации:</h2>
		  <p><i>Если здесь что-то есть, обновите страницу. Иногда сервер не успевает присылать ответы.</i></p>
          <ul id="errorList"></ul>
        `);

	const usersWithoutAnyPostsList = document.getElementById('usersWithoutAnyPosts');
	const usersWithoutGamePostsList = document.getElementById('usersWithoutGamePosts');
	const usersWithDayOffList = document.getElementById('usersWithDayOff');
	const errorList = document.getElementById('errorList');

	const mybb = new MybbSDK(window.location.origin + "/", {
		format: "json",
		charset: "utf-8"
	});

	function chunkArray(arr, chunkSize) {
		const chunks = [];
		for (let i = 0; i < arr.length; i += chunkSize) {
			chunks.push(arr.slice(i, i + chunkSize));
		}
		return chunks;
	}

	mybb.call('users.get', {
			group_id: [1, 2, 3, 4, 5, 6, 7, 8, 9],
			fields: ['user_id', 'username', 'last_post', 'registered'],
			sort_by: 'username',
			limit: 500
		})
		.then(response => {
			const users = response.users;

			users.forEach(user => {
				// Проверка на отсутствие любой активности
				if (stringDateToJsDate(user.last_post) < Date.now() - INTERVAL_ANY_POST * 24 * 60 * 60 * 1000) {
					const li = document.createElement('li');
					li.id = `usersWithoutAnyPosts-${user.user_id}`;
					li.title = `Дата регистрации: ${formatDate(user.registered)}`;
					li.textContent = `@${user.username}`;
					usersWithoutAnyPostsList.appendChild(li);
				}

				// Проверка на отсутствие игровой активности
				if (stringDateToJsDate(user.registered) < Date.now() - INTERVAL_GAME_POST * 24 * 60 * 60 * 1000) {
					const liGame = document.createElement('li');
					liGame.id = `usersWithoutGamePosts-${user.user_id}`;
					liGame.title = `Дата регистрации: ${formatDate(user.registered)}`;
					liGame.textContent = `@${user.username}`;
					usersWithoutGamePostsList.appendChild(liGame);
				}
			});

			// Пагинация для получения топиков
			let skip = 0;
			const limit = 100;
			const allTopics = [];

			const fetchTopics = () => {
				return mybb.call('topic.get', {
						forum_id: FORUMS_WITH_POSTS,
						fields: ['id', 'last_post_date'],
						sort_by: 'last_post_date',
						sort_dir: 'desc',
						skip: skip,
						limit: limit
					})
					.then(topics => {
						if (topics.length === 0) {
							return allTopics; // Возвращаем все топики, если больше нет
						}
						allTopics.push(...topics);
						skip += limit; // Увеличиваем skip для следующего запроса
						return fetchTopics(); // Рекурсивный вызов для получения следующих топиков
					})
					.catch(error => {
						console.error('Ошибка при получении топиков:', error);
						const liErr = document.createElement('li');
						liErr.innerHTML  = `<b>Ошибка при получении топиков:</b> ${error}`;
						errorList.appendChild(liErr);
						return allTopics; // Возвращаем все полученные топики даже в случае ошибки
					});
			};

			return fetchTopics();
		})
		.then(topics => {
			const topicsToConsider = topics.filter(topic => stringDateToJsDate(topic.last_post_date) > Date.now() - INTERVAL_GAME_POST * 24 * 60 * 60 * 1000);
			const topicIds = topicsToConsider.map(topic => topic.id);
			return getPostsInTopics(topicIds);
		})
		.then(() => {
			return getPostsInTopic50();
		})
		.then(() => {});

	function getPostsInTopics(topicIds) {
		const chunkSize = 10;
		const chunks = chunkArray(topicIds, chunkSize);

		return chunks.reduce((promise, chunk) => {
			return promise.then(() => {
				return mybb.call('post.get', {
						topic_id: chunk,
						fields: ['user_id', 'posted'],
						sort_by: 'posted',
						sort_dir: 'desc',
						limit: 100
					})
					.then(posts => {
						if (!posts) {
							return;
						}
						posts.forEach(post => {
							const li = document.getElementById(`usersWithoutGamePosts-${post.user_id}`);
							if (li) {
								li.remove();
							}
						});
					})
					.catch(error => {
						console.error('Ошибка при получении постов:', error);
						const liErr = document.createElement('li');
						liErr.innerHTML  = `<b>Ошибка при получении постов из топиков ${chunk}:</b> ${error}`;
						errorList.appendChild(liErr);
					});
			});
		}, Promise.resolve());
	}

	function getPostsInTopic50() {
		return mybb.call('post.get', {
				topic_id: TOPICS_WITH_DAY_OFF,
				fields: ['user_id', 'posted', 'username'],
				sort_by: 'posted',
				sort_dir: 'desc',
				limit: 100
			})
			.then(posts => {
				if (!posts) {
					return;
				}

				const uniqueUsers = new Set();
				posts.forEach(post => {
					if (stringDateToJsDate(post.posted) > Date.now() - INTERVAL_DAY_OFF_POST * 24 * 60 * 60 * 1000) {
						const username = post.username;
						const userExistsInList = [...usersWithoutAnyPostsList.children].some(li => li.textContent === `@${username}`);
						const userExistsInList2 = [...usersWithoutGamePostsList.children].some(li => li.textContent === `@${username}`);
						if (userExistsInList || userExistsInList2) {
							uniqueUsers.add(username);
						}
					}
				});
				uniqueUsers.forEach(username => {
					const li = document.createElement('li');
					li.textContent = `@${username}`;
					usersWithDayOffList.appendChild(li);
				});
			})
			.catch(error => {
				console.error('Ошибка при получении постов в теме отсутствий:', error);
				const liErr = document.createElement('li');
				liErr.innerHTML  = `<b>Ошибка при получении постов в теме отсутствий:</b> ${error}`;
				errorList.appendChild(liErr);
			});
	}

	function stringDateToJsDate(unix_timestamp) {
		return new Date(Number(unix_timestamp) * 1000);
	}

	function formatDate(unix_timestamp) {
		const date = stringDateToJsDate(unix_timestamp);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1)
			.padStart(2, '0'); // Месяцы начинаются с 0
		const day = String(date.getDate())
			.padStart(2, '0');

		return `${year}-${month}-${day}`;
	}
}
