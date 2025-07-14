const langsSelector = document.querySelector("#langsSelector");
const options = document.querySelectorAll("#langsSelector option");
let lang = localStorage.getItem("langSelected") || "english";
const cache = {};

async function changeLang(lang) {
    try {
        if (!cache[lang]) {
            const res = await fetch(`./i18n/${lang}.json`);
            if (!res.ok) throw new Error(`Failed to fetch ${lang}.json`);
            cache[lang] = await res.json();
        }
        for (const key in cache[lang]) {
            const elem = document.querySelector(`#lng-${key}`);
            if (elem) elem.textContent = cache[lang][key];
        }
    } catch (error) {
        console.error("Error loading translations:", error);
        if (lang !== "english") changeLang("english"); // Fallback
    }
}

function setActiveLink(lang) {
    options.forEach(option => option.classList.remove("active"));
    const activeOption = Array.from(options).find(option => option.dataset.lang === lang);
    if (activeOption) {
        activeOption.classList.add("active");
        langsSelector.value = lang; // Set the select element's value
    }
}

// Initialize
setActiveLink(lang);
changeLang(lang);

// Event listener for language change
langsSelector.addEventListener("change", async () => {
    const newLang = langsSelector.value;
    if (newLang) {
        lang = newLang;
        localStorage.setItem("langSelected", lang);
        setActiveLink(lang);
        await changeLang(lang);
    }
});