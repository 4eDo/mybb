console.group("4eDo script fill_code_as_form ");
console.log("%c~~ Скрипт для заполнения шаблонов через форму. %c https://github.com/4eDo ~~", "font-weight: bold;", "font-weight: bold;");
console.log("More info: https://github.com/4eDo/mybb/tree/main/fill_code_as_form# ");
console.groupEnd();
// URL страницы с шаблонами
const url = '/pages/_templates_user/?nohead';

let needHideNavlinks = typeof NEED_HIDE_NAVLINKS !== 'undefined' ? NEED_HIDE_NAVLINKS : true;

var currentForum = FORUM.topic&&FORUM.topic.forum_id ? FORUM.topic.forum_id : new URLSearchParams(window.location.search).get('fid');
var currentTopic = new URLSearchParams(window.location.search).get('id');

var userTemplateList = [];

const overlay = document.querySelector('.tmpl_overlay');
const popup = document.querySelector('.tmpl_popup');
const navlinks = document.getElementById('pun-navlinks');

function showTemplateWindow() {
	overlay.style.display = 'block';
	popup.style.display = 'block';
	if (needHideNavlinks) navlinks.style.display = 'none';
}

function hideTemplateWindow() {
	overlay.style.display = 'none';
	popup.style.display = 'none';
	if (needHideNavlinks) navlinks.style.display = 'block';
}

function ajaxFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: url,
      method: options.method || 'GET',
      dataType: 'text',
      success: (data, textStatus, jqXHR) => {
        resolve({
          text: () => data,
          status: jqXHR.status,
          ok: jqXHR.status >= 200 && jqXHR.status < 300
        });
      },
      error: (jqXHR, textStatus, errorThrown) => {
        reject(new Error(`Ошибка запроса: ${jqXHR.status} ${jqXHR.statusText}`));
      }
    });
  });
}
async function fetchAndParseTemplates() {
	try {
        let response = await ajaxFetch(url, { responseType: 'text' });
        
        let htmlText = response.text();
        
        // console.log("HTML Text:", htmlText);
        
        let parser = new DOMParser();
		let doc = parser.parseFromString(htmlText, 'text/html');
		let userTemplates = doc.getElementById('userTemplates');
		// console.log("User Templates Block:", userTemplates);
		if (!userTemplates) { console.error("userTemplates не найден."); return;}
		
		let templates = userTemplates.getElementsByClassName('template');
		let hasTemplates = false;
		let id = 0;
		
		for (let template of templates) {
			let name = template.querySelector('.tmpl_name').innerText.trim();
			let forums = template.querySelector('.tmpl_forum_ids').innerText.trim().split(" ");
			let topics = template.querySelector('.tmpl_topic_ids').innerText.trim().split(" ");
			let form = JSON.parse(template.querySelector('.tmpl_form').innerHTML.trim());
			let code = template.querySelector('.tmpl_code').innerHTML.trim();
			// console.log("Template:", { name, forums, topics, form, code });
			
			if(
				(forums.includes("all") || forums.includes(currentForum))
				|| (topics.includes("all") || topics.includes(currentTopic))
			) {
				let templateObj = {
					id: id,
					name: name,
					forums: forums,
					topics: topics,
					form: form,
					code: code
				};
				hasTemplates = true;
				userTemplateList.push(templateObj);
				id++;
			}
		}
		if(hasTemplates) {document.getElementById('templateBtn').style.display = 'inline-block';}
		populateTemplateList();
	} catch (error) { console.error('Ошибка при получении или обработке данных:', error); }
}

function populateTemplateList() {
	let templatesList = document.getElementById('templatesList');
	
	for (let template of userTemplateList) {
		let templateDiv = document.createElement('div');
		templateDiv.className = 'tmpl_template';
		templateDiv.setAttribute('onclick', `drawForm(${template.id})`);
		templateDiv.innerText = template.name;
		templatesList.appendChild(templateDiv);
	}
}

function drawForm(id) {
	let targetTmpl = userTemplateList.find(template => template.id === id);
	
	if (!targetTmpl) {
		console.error(`Template with id ${id} not found.`);
		return;
	}

	console.log("Target Template:", targetTmpl);
	showTargetForm();
	
	let targetForm = document.getElementById('targetForm');
	targetForm.innerHTML = `<div id="templateFormName">${targetTmpl.name}</div>`;
	let table = document.createElement('table');
	targetTmpl.form.forEach((field) => {
		let row = document.createElement('tr');
		let labelCell = document.createElement('td');
		let label = document.createElement('label');
		label.innerText = field.name;
		let labelDescr = document.createElement('div');
		labelDescr.innerText = field.info
			.replaceAll("{{LINK_TEMPLATE}}", `<a href='ссылка на профиль'>ваш любимчик</a>`)
			.replaceAll("<br>", `\n\n`);
		labelCell.appendChild(label);
		labelCell.appendChild(labelDescr);
		
		let inputCell = document.createElement('td');
		let inputElement;
		
		if (field.type === 'text') {
			inputElement = document.createElement('input');
			inputElement.type = 'text';
			if(field.default) {
				inputElement.value=field.default;
			}
		} else if (field.type === 'textarea') {
			inputElement = document.createElement('textarea');
			if(field.default) {
				inputElement.innerText=field.default;
			}
		} else if (field.type === 'number') {
			inputElement = document.createElement('input');
			inputElement.type = 'number';
			if(field.default) {
				inputElement.value=field.default;
			}
		} else if (field.type === 'select') {
			inputElement = document.createElement('select');
			
			if(field.addEmptyOpt) {
				let option = document.createElement('option');
				option.value = "none";
				option.innerText = field.addEmptyOpt;
				inputElement.appendChild(option);
			}
			
			field.optList.forEach(opt => {
				let option = document.createElement('option');
				option.value = opt;
				option.innerText = opt;
				inputElement.appendChild(option);
			});
		}
		if(field.textTransform) {
			inputElement.setAttribute('data-textTransform', field.textTransform);
		}
		
		inputElement.id = `field_${field.tmpl}`;
		inputElement.setAttribute('style', typeof COLOR_INPUT_TEXT_fcaf !== 'undefined' ? COLOR_INPUT_TEXT_fcaf : "color: #000000 !important");
		inputCell.appendChild(inputElement);
		
		row.appendChild(labelCell);
		row.appendChild(inputCell);
		
		table.appendChild(row);
	});
	
	targetForm.appendChild(table);
	
	let button = document.createElement('div');
	button.id = 'tmpl_get-code-button';
	button.innerText = 'Получить код';
	button.setAttribute('onclick', `fillCode(${id})`);
	
	targetForm.appendChild(button);
}



function fillCode(id) {
	let selectedTemplate = userTemplateList.find(template => template.id == id);
	if (!selectedTemplate) { console.error('Шаблон не найден.'); return; }
	let code = selectedTemplate.code;
	
	selectedTemplate.form.forEach(field => {
		let placeholder = `{{${field.tmpl}}}`;
		let inputValue = document.getElementById(`field_${field.tmpl}`).value;
		if(inputValue) {
			if(document.getElementById(`field_${field.tmpl}`).getAttribute("data-textTransform")) {
				switch(document.getElementById(`field_${field.tmpl}`).getAttribute("data-textTransform")) {
					case "lowercase": inputValue = inputValue.toLowerCase(); break;
					case "uppercase": inputValue = inputValue.toUpperCase(); break;
				}
			}
			if(inputValue == "none") {
				code = code.replaceAll(placeholder, "");
			} else {
				code = code.replaceAll(placeholder, inputValue);
			}	
		}
	});
	
	console.log("Сгенерированный код:", code);
	insert(code);
	hideTemplateWindow();
}

function showTargetForm() {
	document.getElementById('templatesList').style.display = 'none';
	document.getElementById('targetForm').style.display = 'flex';
	document.getElementById('tmpl_back-button').style.display = 'flex';
}
function showTemplatesList() {
	document.getElementById('templatesList').style.display = 'flex';
	document.getElementById('targetForm').style.display = 'none';
	document.getElementById('tmpl_back-button').style.display = 'none';
}

fetchAndParseTemplates();
