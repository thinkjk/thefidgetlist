document.addEventListener('DOMContentLoaded', () => {
    const checkboxesContainer = document.getElementById('filtersContainer');
    const searchBar = document.getElementById('searchBar');
    const tableBody = document.querySelector('#groupsTable tbody');
    const resetButton = document.getElementById('resetFilters');

    let groupsData = [];
    let originalGroupsOrder = [];
    let filtersData = [];
    let isRandomized = true;

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            filtersData = data.filters;
            originalGroupsOrder = [...data.groups];
            groupsData = shuffleArray([...data.groups]);
            generateFilters(filtersData);
            attachCheckboxListeners();
            attachSearchListener();
            populateTable(groupsData);
        })
        .catch(error => console.error('Error fetching data:', error));

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

    function populateTable(groups, query = '') {
        tableBody.innerHTML = '';
        groups.forEach(group => {
            const row = document.createElement('tr');

            const imgCell = document.createElement('td');
            const img = document.createElement('img');
            img.src = group.image;
            img.alt = group.name;
            img.classList.add('img-thumbnail');
            imgCell.appendChild(img);
            row.appendChild(imgCell);

            const nameCell = document.createElement('td');
            nameCell.textContent = group.name;
            row.appendChild(nameCell);

            const descCell = document.createElement('td');
            descCell.textContent = group.description;
            row.appendChild(descCell);

            const linkCell = document.createElement('td');
            const link = document.createElement('a');
            link.href = group.link;
            link.textContent = 'Visit';
            link.target = '_blank';
            link.classList.add('btn', 'btn-primary', 'btn-sm');
            linkCell.appendChild(link);
            row.appendChild(linkCell);

            const catCell = document.createElement('td');
            catCell.textContent = group.categories.join(', ');
            row.appendChild(catCell);

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

            if (query) {
                const matchingFidgets = group.fidgets?.filter(fidget =>
                    fidget.name.toLowerCase().includes(query)
                );
                if (matchingFidgets?.length > 0) {
                    const fidgetsRow = document.createElement('tr');
                    const cell = document.createElement('td');
                    cell.colSpan = 6;

                    const container = document.createElement('div');
                    container.classList.add('fidgets-container');
                    matchingFidgets.forEach(fidget => {
                        const fidgetDiv = document.createElement('div');
                        fidgetDiv.classList.add('fidget-item');

                        const img = document.createElement('img');
                        img.src = fidget.image;
                        img.alt = fidget.name;
                        img.classList.add('img-thumbnail');
                        img.addEventListener('click', () =>
                            viewHighResolutionImage(fidget.image)
                        );

                        const details = document.createElement('p');
                        details.innerHTML = `
                            <strong>${fidget.name}</strong><br>
                            Dimensions: ${fidget.dimensions || 'N/A'}<br>
                            Weight: ${fidget.weight || 'N/A'}<br>
                            Material: ${fidget.material || 'Unknown'}
                        `;

                        fidgetDiv.append(img, details);
                        container.appendChild(fidgetDiv);
                    });

                    cell.appendChild(container);
                    fidgetsRow.appendChild(cell);
                    tableBody.appendChild(fidgetsRow);
                }
            }
        });
    }

    function viewHighResolutionImage(imageSrc) {
        const modal = document.createElement('div');
        modal.classList.add('modal');
        modal.style.cssText = `
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: rgba(0, 0, 0, 0.8);
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1000;
        `;

        const img = document.createElement('img');
        img.src = imageSrc;
        img.style.cssText = 'max-width: 90%; max-height: 90%;';

        modal.appendChild(img);
        modal.addEventListener('click', () => modal.remove());

        document.body.appendChild(modal);
    }

    function toggleFidgets(button, group) {
        const fidgetsRow = document.querySelector(`.fidgets-row[data-group="${group.name}"]`);
        if (!fidgetsRow) {
            const row = document.createElement('tr');
            row.classList.add('fidgets-row');
            row.setAttribute('data-group', group.name);

            const cell = document.createElement('td');
            cell.colSpan = 6;

            const container = document.createElement('div');
            container.classList.add('fidgets-container');
            group.fidgets.forEach(fidget => {
                const fidgetDiv = document.createElement('div');
                fidgetDiv.classList.add('fidget-item');

                const img = document.createElement('img');
                img.src = fidget.image;
                img.alt = fidget.name;
                img.classList.add('img-thumbnail');
                img.addEventListener('click', () =>
                    viewHighResolutionImage(fidget.image)
                );

                const details = document.createElement('p');
                details.innerHTML = `
                    <strong>${fidget.name}</strong><br>
                    Dimensions: ${fidget.dimensions || 'N/A'}<br>
                    Weight: ${fidget.weight || 'N/A'}<br>
                    Material: ${fidget.material || 'Unknown'}
                `;

                fidgetDiv.append(img, details);
                container.appendChild(fidgetDiv);
            });

            cell.appendChild(container);
            row.appendChild(cell);
            button.closest('tr').after(row);
        } else {
            fidgetsRow.remove();
        }
    }

    function attachCheckboxListeners() {
        checkboxesContainer.addEventListener('change', () => {
            const selected = [...checkboxesContainer.querySelectorAll('.filter-checkbox:checked')].map(cb => cb.value);
            const filtered = groupsData.filter(group =>
                selected.every(cat => group.categories.includes(cat))
            );
            populateTable(selected.length ? filtered : groupsData);
        });
    }

    function attachSearchListener() {
        searchBar.addEventListener('input', () => {
            const query = searchBar.value.toLowerCase();
            const filteredGroups = groupsData.filter(group => {
                const matchesGroupName = group.name.toLowerCase().includes(query);
                const matchesFidgetName = group.fidgets?.some(fidget =>
                    fidget.name.toLowerCase().includes(query)
                );
                return matchesGroupName || matchesFidgetName;
            });

            populateTable(filteredGroups, query);
        });
    }

    const sortButton = document.createElement('button');
    sortButton.id = 'sortByDate';
    sortButton.className = 'btn btn-secondary w-100 mt-2';
    sortButton.textContent = 'Sort by Date Added';
    resetButton.parentNode.appendChild(sortButton);

    sortButton.addEventListener('click', () => {
        if (isRandomized) {
            groupsData = [...originalGroupsOrder];
            sortButton.textContent = 'Randomize Order';
        } else {
            groupsData = shuffleArray([...originalGroupsOrder]);
            sortButton.textContent = 'Sort by Date Added';
        }
        isRandomized = !isRandomized;
        
        const selected = [...checkboxesContainer.querySelectorAll('.filter-checkbox:checked')].map(cb => cb.value);
        const filtered = groupsData.filter(group =>
            selected.every(cat => group.categories.includes(cat))
        );
        
        const query = searchBar.value.toLowerCase();
        const searchFiltered = (selected.length ? filtered : groupsData).filter(group => {
            const matchesGroupName = group.name.toLowerCase().includes(query);
            const matchesFidgetName = group.fidgets?.some(fidget =>
                fidget.name.toLowerCase().includes(query)
            );
            return matchesGroupName || matchesFidgetName;
        });
        
        populateTable(searchFiltered, query);
    });

    resetButton.addEventListener('click', () => {
        checkboxesContainer.querySelectorAll('.filter-checkbox').forEach(cb => (cb.checked = false));
        searchBar.value = '';
        populateTable(isRandomized ? shuffleArray([...originalGroupsOrder]) : [...originalGroupsOrder]);
    });
});
