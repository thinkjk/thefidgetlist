document.addEventListener('DOMContentLoaded', () => {
    const checkboxesContainer = document.getElementById('filtersContainer');
    const searchBar = document.getElementById('searchBar');
    const tableBody = document.querySelector('#groupsTable tbody');
    const resetButton = document.getElementById('resetFilters');

    let groupsData = [];
    let originalGroupsOrder = [];
    let filtersData = [];
    let fidgetsMap = {};  
    let isRandomized = true;

    // 1) Fetch groups.json and fidgets.json in parallel
    Promise.all([
        fetch('groups.json').then(res => res.json()),
        fetch('fidgets.json').then(res => res.json())
    ])
    .then(([groupsResp, fidgetsResp]) => {
        // Setup groups & filters from groups.json
        filtersData = groupsResp.filters;
        groupsData = groupsResp.groups;
        originalGroupsOrder = [...groupsData];

        // Build a map from fidgets.json: group_name -> items
        fidgetsResp.fidgets.forEach(groupBlock => {
            const key = groupBlock.group_name.trim().toLowerCase();
            fidgetsMap[key] = groupBlock.items;
        });

        // Attach fidget items to each group by matching names
        groupsData.forEach(group => {
            const groupKey = group.name.trim().toLowerCase();
            group.fidgets = fidgetsMap[groupKey] || [];
        });

        generateFilters(filtersData);
        attachCheckboxListeners();
        attachSearchListener();

        // Shuffle groups initially
        groupsData = shuffleArray([...groupsData]);
        populateTable(groupsData);
    })
    .catch(error => console.error('Error fetching JSON data:', error));

    /**
     * Shuffle array in place
     */
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Generate filter checkboxes
     */
    function generateFilters(filters) {
        checkboxesContainer.innerHTML = '';
        filters.forEach(filter => {
            const colDiv = document.createElement('div');
            colDiv.classList.add('col-6', 'col-md-4', 'mb-3');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('form-check-input', 'filter-checkbox');
            checkbox.value = filter;

            const label = document.createElement('label');
            label.textContent = filter;
            label.classList.add('form-check-label');

            const formCheckDiv = document.createElement('div');
            formCheckDiv.classList.add('form-check');
            formCheckDiv.append(checkbox, label);

            colDiv.appendChild(formCheckDiv);
            checkboxesContainer.appendChild(colDiv);
        });
    }

    /**
     * Populate the table with groups
     */
    function populateTable(groups, query = '') {
        tableBody.innerHTML = '';
        groups.forEach(group => {
            const row = document.createElement('tr');

            // 1) Group image
            const imgCell = document.createElement('td');
            const groupImg = document.createElement('img');
            groupImg.src = group.image;
            groupImg.alt = group.name;
            groupImg.classList.add('img-thumbnail');
            imgCell.appendChild(groupImg);
            row.appendChild(imgCell);

            // 2) Group name
            const nameCell = document.createElement('td');
            nameCell.textContent = group.name;
            row.appendChild(nameCell);

            // 3) Description
            const descCell = document.createElement('td');
            descCell.textContent = group.description;
            row.appendChild(descCell);

            // 4) Link
            const linkCell = document.createElement('td');
            const link = document.createElement('a');
            link.href = group.link;
            link.textContent = 'Visit';
            link.target = '_blank';
            link.classList.add('btn', 'btn-primary', 'btn-sm');
            linkCell.appendChild(link);
            row.appendChild(linkCell);

            // 5) Categories
            const catCell = document.createElement('td');
            catCell.textContent = group.categories.join(', ');
            row.appendChild(catCell);

            // 6) Fidgets button
            const fidgetCell = document.createElement('td');
            if (group.fidgets && group.fidgets.length > 0) {
                const fidgetButton = document.createElement('button');
                fidgetButton.textContent = 'View Fidgets';
                fidgetButton.classList.add('btn', 'btn-primary', 'btn-sm');
                fidgetButton.addEventListener('click', () => toggleFidgets(fidgetButton, group));
                fidgetCell.appendChild(fidgetButton);
            }
            row.appendChild(fidgetCell);

            tableBody.appendChild(row);
        });
    }

    /**
     * Show/hide a row that displays fidgets for a group
     */
    function toggleFidgets(button, group) {
        const existingRow = document.querySelector(`.fidgets-row[data-group="${group.name}"]`);
        if (existingRow) {
            // If already present, remove it
            existingRow.remove();
            return;
        }

        // Create a new row below the group
        const row = document.createElement('tr');
        row.classList.add('fidgets-row');
        row.setAttribute('data-group', group.name);

        const cell = document.createElement('td');
        cell.colSpan = 6;

        const container = document.createElement('div');
        container.classList.add('fidgets-container');

        // For each fidget item
        group.fidgets.forEach((fidgetItem, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('fidget-item');

            // 1) Top block: name & dimensions (outside carousel)
            const staticDiv = document.createElement('div');
            staticDiv.style.padding = '0.5rem';
            staticDiv.style.backgroundColor = '#f8f9fa';
            staticDiv.style.color = '#333';
            staticDiv.style.textAlign = 'center';

            let staticHTML = `<strong style="font-size:1.2rem;">${fidgetItem.name}</strong>`;

            // Dimensions line
            if (fidgetItem.dimensions) {
            staticHTML += `<br><span style="font-size:0.9rem;">Dimensions: ${fidgetItem.dimensions}</span>`;
            }

            // Button size line (after dimensions)
            if (fidgetItem.button_size) {
            staticHTML += `<br><span style="font-size:0.9rem;">Button Size: ${fidgetItem.button_size}</span>`;
            }

            staticDiv.innerHTML = staticHTML;
            itemDiv.appendChild(staticDiv);

            // 2) The rotating carousel for the image(s)
            if (fidgetItem.variants && fidgetItem.variants.length > 0) {
                const numVariants = fidgetItem.variants.length;
                const carouselId = `${group.name.replace(/\s+/g, '')}-item${index}`;

                const carouselDiv = document.createElement('div');
                carouselDiv.id = `carousel-${carouselId}`;
                carouselDiv.classList.add('carousel', 'slide');
                // No auto-advance
                carouselDiv.setAttribute('data-bs-interval', 'false');
                carouselDiv.setAttribute('data-bs-ride', 'false');
                carouselDiv.style.width = '200px';
                // position:relative to anchor arrows
                carouselDiv.style.position = 'relative';

                const innerDiv = document.createElement('div');
                innerDiv.classList.add('carousel-inner');
                // also position relative
                innerDiv.style.position = 'relative';

                // We'll hold the indicators (dots) here
                const indicatorsDiv = document.createElement('div');
                indicatorsDiv.classList.add('carousel-indicators');

                fidgetItem.variants.forEach((variant, vIndex) => {
                    // Each image is a carousel-item
                    const slideDiv = document.createElement('div');
                    slideDiv.classList.add('carousel-item');
                    if (vIndex === 0) slideDiv.classList.add('active');

                    const variantImg = document.createElement('img');
                    variantImg.src = variant.image;
                    variantImg.alt = variant.material || '';
                    variantImg.classList.add('d-block', 'w-100');
                    variantImg.style.height = '150px';
                    variantImg.style.objectFit = 'cover';

                    // On click => fullscreen modal
                    variantImg.addEventListener('click', () => {
                        showFullsizeCarousel(fidgetItem, vIndex);
                    });
                    slideDiv.appendChild(variantImg);

                    // BOTTOM block for material & weight
                    const bottomInfo = document.createElement('div');
                    bottomInfo.style.padding = '0.5rem';
                    bottomInfo.style.backgroundColor = '#f8f9fa';
                    bottomInfo.style.color = '#333';
                    bottomInfo.style.textAlign = 'center';
                    bottomInfo.style.fontSize = '0.9rem';

                    let bottomHTML = '';
                    if (variant.material) {
                        bottomHTML += `<strong>Material:</strong> ${variant.material}`;
                    }
                    if (variant.weight) {
                        bottomHTML += `<br><strong>Weight:</strong> ${variant.weight}`;
                    }
                    bottomInfo.innerHTML = bottomHTML;
                    slideDiv.appendChild(bottomInfo);

                    innerDiv.appendChild(slideDiv);

                    // If multiple variants => build an indicator button
                    if (numVariants > 1) {
                        const indicatorBtn = document.createElement('button');
                        indicatorBtn.type = 'button';
                        indicatorBtn.setAttribute('data-bs-target', `#carousel-${carouselId}`);
                        indicatorBtn.setAttribute('data-bs-slide-to', `${vIndex}`);
                        if (vIndex === 0) {
                            indicatorBtn.classList.add('active');
                            indicatorBtn.setAttribute('aria-current', 'true');
                        }
                        indicatorsDiv.appendChild(indicatorBtn);
                    }
                });

                carouselDiv.appendChild(innerDiv);

                // If more than 1 variant => show arrows & indicators
                if (numVariants > 1) {
                    carouselDiv.appendChild(indicatorsDiv);

                    // Prev arrow
                    const prevBtn = document.createElement('button');
                    prevBtn.classList.add('carousel-control-prev');
                    prevBtn.type = 'button';
                    prevBtn.setAttribute('data-bs-target', `#carousel-${carouselId}`);
                    prevBtn.setAttribute('data-bs-slide', 'prev');
                    prevBtn.innerHTML = `
                      <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                      <span class="visually-hidden">Previous</span>
                    `;

                    // Next arrow
                    const nextBtn = document.createElement('button');
                    nextBtn.classList.add('carousel-control-next');
                    nextBtn.type = 'button';
                    nextBtn.setAttribute('data-bs-target', `#carousel-${carouselId}`);
                    nextBtn.setAttribute('data-bs-slide', 'next');
                    nextBtn.innerHTML = `
                      <span class="carousel-control-next-icon" aria-hidden="true"></span>
                      <span class="visually-hidden">Next</span>
                    `;

                    carouselDiv.appendChild(prevBtn);
                    carouselDiv.appendChild(nextBtn);
                }

                itemDiv.appendChild(carouselDiv);

            } else {
                // If no variants => no carousel
                const fallback = document.createElement('p');
                fallback.textContent = fidgetItem.name || 'Unnamed Fidget';
                itemDiv.appendChild(fallback);
            }

            container.appendChild(itemDiv);
        });

        cell.appendChild(container);
        row.appendChild(cell);
        button.closest('tr').after(row);
    }

    /**
     * Show a fullscreen modal for the fidget
     */
    function showFullsizeCarousel(fidgetItem, startIndex) {
        const modalId = `fullsizeCarouselModal-${Date.now()}`;

        const modalDiv = document.createElement('div');
        modalDiv.classList.add('modal', 'fade');
        modalDiv.id = modalId;
        modalDiv.setAttribute('tabindex', '-1');
        modalDiv.setAttribute('aria-hidden', 'true');

        modalDiv.innerHTML = `
          <div class="modal-dialog modal-fullscreen">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">${fidgetItem.name}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body p-0">
              </div>
            </div>
          </div>
        `;

        document.body.appendChild(modalDiv);

        const bigCarouselId = `bigCarousel-${Date.now()}`;
        const carouselDiv = document.createElement('div');
        carouselDiv.classList.add('carousel', 'slide');
        // no auto-advance
        carouselDiv.setAttribute('data-bs-interval', 'false');
        carouselDiv.setAttribute('data-bs-ride', 'false');
        carouselDiv.id = bigCarouselId;

        const innerDiv = document.createElement('div');
        innerDiv.classList.add('carousel-inner');
        innerDiv.style.position = 'relative';

        const indicatorsDiv = document.createElement('div');
        indicatorsDiv.classList.add('carousel-indicators');

        const numVariants = fidgetItem.variants.length;
        fidgetItem.variants.forEach((variant, vIndex) => {
            const slideDiv = document.createElement('div');
            slideDiv.classList.add('carousel-item');
            if (vIndex === startIndex) slideDiv.classList.add('active');

            const variantImg = document.createElement('img');
            variantImg.src = variant.image;
            variantImg.alt = variant.material || '';
            variantImg.classList.add('d-block', 'w-100');
            variantImg.style.height = '85vh';
            variantImg.style.objectFit = 'contain';

            slideDiv.appendChild(variantImg);

            // material & weight at the bottom
            const bottomInfo = document.createElement('div');
            bottomInfo.style.padding = '1rem';
            bottomInfo.style.backgroundColor = '#f8f9fa';
            bottomInfo.style.color = '#333';
            bottomInfo.style.textAlign = 'center';
            bottomInfo.style.fontSize = '1rem';

            let bottomHTML = '';
            if (variant.material) {
                bottomHTML += `<strong>Material:</strong> ${variant.material}`;
            }
            if (variant.weight) {
                bottomHTML += `<br><strong>Weight:</strong> ${variant.weight}`;
            }
            bottomInfo.innerHTML = bottomHTML;
            slideDiv.appendChild(bottomInfo);

            innerDiv.appendChild(slideDiv);

            // If multiple images => build indicator dots
            if (numVariants > 1) {
                const indicatorBtn = document.createElement('button');
                indicatorBtn.type = 'button';
                indicatorBtn.setAttribute('data-bs-target', `#${bigCarouselId}`);
                indicatorBtn.setAttribute('data-bs-slide-to', `${vIndex}`);
                if (vIndex === startIndex) {
                    indicatorBtn.classList.add('active');
                    indicatorBtn.setAttribute('aria-current', 'true');
                }
                indicatorsDiv.appendChild(indicatorBtn);
            }
        });

        carouselDiv.appendChild(innerDiv);

        // Only show arrows + indicator dots if more than 1 variant
        if (numVariants > 1) {
            carouselDiv.appendChild(indicatorsDiv);

            const prevBtn = document.createElement('button');
            prevBtn.classList.add('carousel-control-prev');
            prevBtn.type = 'button';
            prevBtn.setAttribute('data-bs-target', `#${bigCarouselId}`);
            prevBtn.setAttribute('data-bs-slide', 'prev');
            prevBtn.innerHTML = `
              <span class="carousel-control-prev-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Previous</span>
            `;

            const nextBtn = document.createElement('button');
            nextBtn.classList.add('carousel-control-next');
            nextBtn.type = 'button';
            nextBtn.setAttribute('data-bs-target', `#${bigCarouselId}`);
            nextBtn.setAttribute('data-bs-slide', 'next');
            nextBtn.innerHTML = `
              <span class="carousel-control-next-icon" aria-hidden="true"></span>
              <span class="visually-hidden">Next</span>
            `;

            carouselDiv.appendChild(prevBtn);
            carouselDiv.appendChild(nextBtn);
        }

        const modalBody = modalDiv.querySelector('.modal-body');
        modalBody.appendChild(carouselDiv);

        // Show the modal
        const modalObj = new bootstrap.Modal(modalDiv);
        modalObj.show();

        // Cleanup when modal is closed
        modalDiv.addEventListener('hidden.bs.modal', () => {
            modalDiv.remove();
        });
    }

    /**
     * Attach category filters
     */
    function attachCheckboxListeners() {
        checkboxesContainer.addEventListener('change', () => {
            const selected = [...checkboxesContainer.querySelectorAll('.filter-checkbox:checked')]
                .map(cb => cb.value);
            const filtered = groupsData.filter(group =>
                selected.every(cat => group.categories.includes(cat))
            );
            populateTable(selected.length ? filtered : groupsData);
        });
    }

    /**
     * Attach search logic
     */
    function attachSearchListener() {
        searchBar.addEventListener('input', () => {
            const query = searchBar.value.toLowerCase();
            const filteredGroups = groupsData.filter(group => {
                const matchesGroupName = group.name.toLowerCase().includes(query);
                const matchesFidgetName = group.fidgets?.some(item =>
                    item.name.toLowerCase().includes(query)
                );
                return matchesGroupName || matchesFidgetName;
            });
            populateTable(filteredGroups, query);
        });
    }

    /**
     * Sort/Randomize button
     */
    const sortButton = document.createElement('button');
    sortButton.id = 'sortByDate';
    sortButton.className = 'btn btn-secondary w-100 mt-2';
    sortButton.textContent = 'Sort by Date Added';
    resetButton.parentNode.appendChild(sortButton);

    sortButton.addEventListener('click', () => {
        if (isRandomized) {
            // Revert to original order
            groupsData = [...originalGroupsOrder];
            sortButton.textContent = 'Randomize Order';
        } else {
            // Shuffle again
            groupsData = shuffleArray([...originalGroupsOrder]);
            sortButton.textContent = 'Sort by Date Added';
        }
        isRandomized = !isRandomized;

        const selected = [...checkboxesContainer.querySelectorAll('.filter-checkbox:checked')]
            .map(cb => cb.value);
        const filtered = groupsData.filter(group =>
            selected.every(cat => group.categories.includes(cat))
        );
        const query = searchBar.value.toLowerCase();
        const searchFiltered = (selected.length ? filtered : groupsData).filter(group => {
            const matchesGroupName = group.name.toLowerCase().includes(query);
            const matchesFidgetName = group.fidgets?.some(item =>
                item.name.toLowerCase().includes(query)
            );
            return matchesGroupName || matchesFidgetName;
        });
        populateTable(searchFiltered, query);
    });

    /**
     * Reset filters
     */
    resetButton.addEventListener('click', () => {
        checkboxesContainer.querySelectorAll('.filter-checkbox').forEach(cb => (cb.checked = false));
        searchBar.value = '';
        populateTable(isRandomized ? shuffleArray([...originalGroupsOrder]) : [...originalGroupsOrder]);
    });
});
