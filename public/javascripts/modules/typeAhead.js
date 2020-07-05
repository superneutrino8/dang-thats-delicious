import axios from "axios";
import dompurify from "dompurify";

function searchResultHTML(stores) {
    return stores
        .map((store) => {
            return `
        <a href="/store/${store.slug}" class="search__result">
            <strong>${store.name}</strong>
        </a>
        `;
        })
        .join("");
}

function typeAhead(search) {
    const searchInput = search.querySelector(".search__input");
    const searchResult = search.querySelector(".search__results");

    searchInput.on("input", function() {
        if (!this.value) {
            searchResult.style.display = "none";
            return;
        }
        searchResult.style.display = "block";
        axios
            .get(`/api/search/?q=${this.value}`)
            .then((res) => {
                if (res.data.length) {
                    searchResult.innerHTML = dompurify.sanitize(
                        searchResultHTML(res.data)
                    );
                    return;
                }
                searchResult.innerHTML = dompurify.sanitize(
                    `<div class="search__result">No results for ${this.value}</div>`
                );
            })
            .catch((error) => {
                console.error(error);
            });
    });

    searchInput.on("keyup", function(e) {
        if (![38, 40, 13].includes(e.keyCode)) {
            return;
        }
        const activeClass = "search__result--active";
        const current = search.querySelector(`.${activeClass}`);
        const items = search.querySelectorAll(".search__result");
        let next;
        if (e.keyCode === 40 && current) {
            next = current.nextElementSibling || items[0];
        } else if (e.keyCode === 40) {
            next = items[0];
        } else if (e.keyCode === 38 && current) {
            next = current.previousElementSibling || items[items.length - 1];
        } else if (e.keyCode === 38) {
            next = items[items.length - 1];
        } else if (e.keyCode === 13 && current.href) {
            window.location = current.href;
            return;
        }
        console.log("Current: ", current);
        if (current) {
            current.classList.remove(activeClass);
        }
        next.classList.add(activeClass);
    });
}

export default typeAhead;
