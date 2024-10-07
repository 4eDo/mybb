console.group("Script Info");
console.log("%c~~ Скрипт для автоматической проверки отсутствия игровой активности. %c https://github.com/4eDo %c ~~", "font-weight: bold;", "font-weight: bold;");
console.groupEnd();

if(FORUM_URL && FORUMS_WITH_POSTS && TOPICS_WITH_DAY_OFF && INTERVAL_ANY_POST && INTERVAL_GAME_POST && INTERVAL_DAY_OFF_POST) {
	$('#result_4eDo')
		.append(`
		  <h2>Отсутствие любой активности более ${INTERVAL_ANY_POST} д.</h2>
		  <ul id="usersWithoutAnyPosts"></ul>
		`);
	$('#result_4eDo')
		.append(`
		  <h2>Отсутствие игровой активности более ${INTERVAL_GAME_POST} д.</h2>
		  <ul id="usersWithoutGamePosts"></ul>
		`);
	$('#result_4eDo')
		.append(`
		  <h2>Были сообщения в теме отсутствий за последние ${INTERVAL_DAY_OFF_POST} д.</h2>
		  <ul id="usersWithDayOff"></ul>
		`);
	const usersWithoutAnyPostsList = document.getElementById('usersWithoutAnyPosts');
	const usersWithoutGamePostsList = document.getElementById('usersWithoutGamePosts');
	const usersWithDayOffList = document.getElementById('usersWithDayOff');

	const mybb = new MybbSDK(FORUM_URL, {
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
			fields: ['user_id', 'username', 'last_post'],
			limit: 500
		})
		.then(response => {
			const users = response.users;

			users.forEach(user => {
				if (stringDateToJsDate(user.last_post) < Date.now() - INTERVAL_ANY_POST * 24 * 60 * 60 * 1000) {
					const li = document.createElement('li');
					li.id = `usersWithoutAnyPosts-${user.user_id}`;
					li.textContent = `@${user.username}`;
					usersWithoutAnyPostsList.appendChild(li);
				}
				if (stringDateToJsDate(user.last_post) < Date.now() - INTERVAL_GAME_POST * 24 * 60 * 60 * 1000) {
					const li = document.createElement('li');
					li.id = `usersWithoutGamePosts-${user.user_id}`;
					li.textContent = `@${user.username}`;
					usersWithoutGamePostsList.appendChild(li);
				}
			});

			let skip = 0;
			let limit = 100;

			return mybb.call('topic.get', {
				forum_id: FORUMS_WITH_POSTS,
				fields: ['id', 'last_post_date'],
				sort_by: 'last_post_date',
				sort_dir: 'desc',
				skip: skip,
				limit: limit
			});
		})
		.then(topics => {
			console.log("topics");
			console.log(topics);
			if (topics.length === 0) {
				return [];
			}
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
							if (usersWithoutGamePosts.has(post.user_id)) {
								const li = document.getElementById(`usersWithoutGamePosts-${post.user_id}`);
								if (li) {
									li.remove();
								}
							}
						});
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
			});
	}

	function stringDateToJsDate(unix_timestamp) {
		return new Date(Number(unix_timestamp) * 1000);
	}
}
