console.group("4eDo script fill_code_as_form v2.1.3");
console.log("%c~~ Скрипт для заполнения шаблонов через форму. %c https://github.com/4eDo ~~", "font-weight: bold;", "font-weight: bold;");
console.log("More info: https://github.com/4eDo/mybb/tree/main/fill_code_as_form# ");
console.groupEnd();

var url = TEMPLATE_SRC;

let needHideNavlinks = typeof NEED_HIDE_NAVLINKS !== 'undefined' ? NEED_HIDE_NAVLINKS : true;

var currentForum = FORUM.topic && FORUM.topic.forum_id ? FORUM.topic.forum_id : new URLSearchParams(window.location.search).get('fid');
var currentTopic = new URLSearchParams(window.location.search).get('id') ? new URLSearchParams(window.location.search).get('id') : new URLSearchParams(window.location.search).get('tid');

var userTemplateList = [];


/* ----------------------------------------------------------- */
/* ОБРАБОТКА КНОПОК
   выбора шаблонов, закрытия, показа списка и т.д. */
/* ----------------------------------------------------------- */
const overlay = document.querySelector('.tmpl_overlay');
const popup = document.querySelector('.tmpl_popup');
const navlinks = document.getElementById('pun-navlinks');
const backButton = document.getElementById('tmpl_back-button');
const closeButton = document.getElementById('tmpl_close-button');
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
function handleBackButtonEnter(event) {
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        showTemplatesList();
    }
}
function handleCloseButtonEnter(event) {
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        hideTemplateWindow();
    }
}
if (backButton) {
    backButton.setAttribute('role', 'button');
    backButton.tabIndex = 0;
    backButton.addEventListener('keydown', handleBackButtonEnter);
}
if (closeButton) {
    closeButton.setAttribute('role', 'button');
    closeButton.tabIndex = 0;
    closeButton.addEventListener('keydown', handleCloseButtonEnter);
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

/* ----------------------------------------------------------- */
/* ИНИЦИАЛИЗАЦИЯ СПИСКА ШАБЛОНОВ */
/* ----------------------------------------------------------- */
function ajaxFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(options.method || 'GET', url);
        xhr.responseType = 'arraybuffer';

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const decoder = new TextDecoder('windows-1251');
                    const decodedData = decoder.decode(xhr.response);

                    resolve({
                        text: () => decodedData,
                        status: xhr.status,
                        ok: true
                    });
                } catch (e) {
                    reject(new Error(`Ошибка парсинга: ${e.message}`));
                }

            } else {
                reject(new Error(`Ошибка запроса: ${xhr.status} ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => {
            reject(new Error("Ошибка сети"));
        };

        xhr.send();
    });
}

async function fetchAndParseTemplates() {
    if (typeof TEMPLATE_SRC == 'undefined') { console.error("Источник шаблонов не подключен."); return; }
    try {
        let response = await ajaxFetch(url, { responseType: 'text' });

        let htmlText = response.text();

        // console.log("HTML Text:", htmlText);

        let parser = new DOMParser();
        let doc = parser.parseFromString(htmlText, 'text/html');
        let userTemplates = doc.getElementById('userTemplates');
        // console.log("User Templates Block:", userTemplates);
        if (!userTemplates) { console.error("userTemplates не найден."); return; }

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

            if  (
				forums.includes(currentForum)
			    || (forums.includes("all") && topics.includes("all")) // Все форумы + все темы
			    || (forums.includes("all") && topics.includes(currentTopic)) // Все форумы + конкретная тема
			    || (forums.includes(currentForum) && topics.includes("all")) // Конкретный форум + все темы
			    || (forums.includes(currentForum) && topics.includes(currentTopic)) // Конкретный форум + конкретная тема
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
        if (hasTemplates) { document.getElementById('templateBtn').style.display = 'inline-block'; }
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
        templateDiv.setAttribute('tabindex', '0');
        templateDiv.setAttribute('role', 'button');

		templateDiv.addEventListener('keydown', function(event) {
            if (event.key === 'Enter' || event.keyCode === 13) {
                event.preventDefault(); // Prevent form submission if inside a form
                drawForm(template.id); // Call the function that handles the click
            }
        });
	
        templatesList.appendChild(templateDiv);
    }
}

/* ----------------------------------------------------------- */
/* ОТРИСОВКА ФОРМЫ */
/* ----------------------------------------------------------- */
function drawForm(id) {
    let targetTmpl = userTemplateList.find(template => template.id === id);

    if (!targetTmpl) {
        console.error(`Template with id ${id} not found.`);
        return;
    }

    showTargetForm();

    let targetForm = document.getElementById('targetForm');
    targetForm.innerHTML = `<div id="templateFormName">${targetTmpl.name}</div>`;
    let table = document.createElement('table');

    generateFormHTML(targetTmpl.form, table);

    targetForm.appendChild(table);

    table.querySelectorAll('select').forEach(selectElement => {
        const fieldTmpl = selectElement.id.replace('field_', '');
        selectElement.addEventListener('change', () => {
            handleSwitchFields(selectElement, fieldTmpl);
        });
        handleSwitchFields(selectElement, fieldTmpl);
    });

    let button = document.createElement('div');
    button.id = 'tmpl_get-code-button';
    button.innerText = 'Получить код';
    button.setAttribute('tabindex', '0');
    button.setAttribute('role', 'button');
    button.setAttribute('onclick', `fillCode(${id})`);

    button.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.keyCode === 13) {
            event.preventDefault();
            fillCode(id);
        }
    });
	
    targetForm.appendChild(button);
}

function renderFormField(field) {
    let inputElement;

	console.log(field);

    if (field.type === 'text') {
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        if (field.default) {
            inputElement.value = field.default;
        }
    } else if (field.type === 'textarea') {
        inputElement = document.createElement('textarea');
        if (field.default) {
            inputElement.innerText = field.default;
        }
    } else if (field.type === 'number') {
        inputElement = document.createElement('input');
        inputElement.type = 'number';
        if (field.default) {
            inputElement.value = field.default;
        }
    } else if (field.type === 'select') {
        inputElement = document.createElement('select');

        if (field.addEmptyOpt) {
            let option = document.createElement('option');
            option.value = "none";
            option.innerText = field.addEmptyOpt;
            inputElement.appendChild(option);
        }

        if (field.optList) {
            field.optList.forEach(opt => {
                let option = document.createElement('option');
                option.value = opt;
                option.innerText = opt;
                inputElement.appendChild(option);
            });
        }

        if (field.optValAndNameList) {
            field.optValAndNameList.forEach(opt => {
                let option = document.createElement('option');
                option.value = opt.val;
                option.innerText = opt.name;
                inputElement.appendChild(option);
            });
        }
    }

    if (field.textTransform) {
        inputElement.setAttribute('data-textTransform', field.textTransform);
    }

    if (field.valIfEmpty) {
        inputElement.setAttribute('data-valIfEmpty', field.valIfEmpty);
    }

    if (field.default) {
        inputElement.setAttribute('data-default', field.default);
    }
	
    inputElement.id = `field_${field.tmpl}`;
    inputElement.setAttribute('style', typeof COLOR_INPUT_TEXT_fcaf !== 'undefined' ? COLOR_INPUT_TEXT_fcaf : "color: #000000 !important");

    return {
        element: inputElement,
        field: field
    };
}

function generateFormHTML(form, table) {
    form.forEach(field => {
        let { element: inputElement, field: currentField } = renderFormField(field);

        let isSwitchCase = field?.parentTmpl || false;
        let hidden = isSwitchCase ? 'hidden' : '';
        let targetVal = field.targetVal || '';
        let parentTmpl = field.parentTmpl || '';

        let tr = document.createElement('tr');
        tr.setAttribute('data-parent-tmpl', parentTmpl);
        tr.setAttribute('data-target-val', targetVal);
        if (isSwitchCase) {
            tr.hidden = true;
        }

        let tdLabel = document.createElement('td');
	    /* .replaceAll("<br>", `\n\n`) */
        tdLabel.innerHTML = `
            <label>${field.name}</label>
            <div>${field.info.replaceAll("{{LINK_TEMPLATE}}", `<code>&lt;a href='адрес_ссылки'&gt;текст_ссылки&lt;/a&gt;</code>`)}</div>
        `;

        let tdInput = document.createElement('td');
        if (inputElement) {
            tdInput.appendChild(inputElement);
        }

        tr.appendChild(tdLabel);
        tr.appendChild(tdInput);
        table.appendChild(tr);
    });
}

function handleSwitchFields(selectElement, parentTmpl) {
    const selectedValue = selectElement.value;

    hideAllChildren(parentTmpl);

    const childRowsToShow = document.querySelectorAll(`tr[data-parent-tmpl="${parentTmpl}"][data-target-val="${selectedValue}"]`);
    childRowsToShow.forEach(row => {
        row.hidden = false;
        const inputs = row.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            setDefaultValue(input);
        });
    });
}

function setDefaultValue(input) {
	// console.log("Set default to input " + input.id);
    const defaultValue = input.dataset.default;
    if (defaultValue) {
        if (input.type === 'select-one') {
            for (let i = 0; i < input.options.length; i++) {
                if (input.options[i].value === defaultValue) {
                    input.selectedIndex = i;
                    break;
                }
            }
        } else {
            input.value = defaultValue;
        }
    }
}

function hideAllChildren(parentTmpl) {
    const childRows = document.querySelectorAll(`tr[data-parent-tmpl="${parentTmpl}"]`);
    childRows.forEach(row => {
        row.hidden = true;
        const inputs = row.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            resetInput(input);
        });

        hideAllChildren(row.querySelector('select')?.id.replace('field_', ''));
    });
}

function resetInput(input) {
	// console.log("Reset input " + input.id);
    if (input.type === 'select-one') {
        input.selectedIndex = 0;
    } else {
        input.value = '';
    }
}

/* ----------------------------------------------------------- */
/* ЗАПОЛНЕНИЕ КОДА ПО ФОРМЕ */
/* ----------------------------------------------------------- */
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
            
			const before = field?.wrapperBefore || '';
	       		const after = field?.wrapperAfter || '';
            
			if(inputValue == "none") {
				code = code.replaceAll(placeholder, "");
			} else {
           			inputValue = before + inputValue + after;
				code = code.replaceAll(placeholder, inputValue);
			}	
		} else if(document.getElementById(`field_${field.tmpl}`).getAttribute("data-valIfEmpty")) {
			let valIfEmpty = document.getElementById(`field_${field.tmpl}`).getAttribute("data-valIfEmpty");
			if(valIfEmpty.length > 0) {
				code = code.replaceAll(placeholder, valIfEmpty == "none" ? "" : valIfEmpty);
			}
		}
	});

	code = code.replaceAll("{{CURRENT_USER_ID}}", UserID);
	code = code.replaceAll("{{CURRENT_USER_LOGIN}}", UserLogin);
    code = code.replaceAll("{{CURRENT_USER_AVATAR}}", UserAvatar);
	code = code.replaceAll("{{CURRENT_TOPIC_SRC}}", window.location);
	
	console.log("Сгенерированный код:", code);
	insert(code);
	hideTemplateWindow();
}

fetchAndParseTemplates();
