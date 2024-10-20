// script.js

document.addEventListener('DOMContentLoaded', () => {
    const checkboxes = document.querySelectorAll('.filter-checkbox');
    const tableBody = document.querySelector('#groupsTable tbody');
    const resetButton = document.getElementById('resetFilters');

    let groupsData = [];

    // Fetch data from data.json
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            groupsData = data.groups;
            populateTable(groupsData);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load data.</td></tr>';
        });

    // Function to populate the table
    function populateTable(data) {
        tableBody.innerHTML = ''; // Clear existing data

        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No groups found.</td></tr>';
            return;
        }

        data.forEach(group => {
            const row = document.createElement('tr');
            row.setAttribute('data-categories', group.categories.join(', '));

            // Image
            const imgCell = document.createElement('td');
            const img = document.createElement('img');
            img.src = group.image;
            img.alt = group.name;
            img.classList.add('img-thumbnail');
            img.width = 100;
            imgCell.appendChild(img);
            row.appendChild(imgCell);

            // Group Name
            const nameCell = document.createElement('td');
            nameCell.textContent = group.name;
            row.appendChild(nameCell);

            // Description
            const descCell = document.createElement('td');
            descCell.textContent = group.description;
            row.appendChild(descCell);

            // Link
            const linkCell = document.createElement('td');
            const link = document.createElement('a');
            link.href = group.link;
            link.textContent = 'Visit Group';
            link.target = '_blank';
            link.classList.add('btn', 'btn-primary', 'btn-sm');
            linkCell.appendChild(link);
            row.appendChild(linkCell);

            // Categories
            const catCell = document.createElement('td');
            catCell.textContent = group.categories.join(', ');
            row.appendChild(catCell);

            tableBody.appendChild(row);
        });
    }

    // Function to filter the table
    function filterTable() {
        const selectedCategories = Array.from(checkboxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

        if (selectedCategories.length === 0) {
            populateTable(groupsData);
            return;
        }

        const filteredData = groupsData.filter(group =>
            selectedCategories.some(cat => group.categories.includes(cat))
        );

        populateTable(filteredData);
    }

    // Attach event listeners to checkboxes
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', filterTable);
    });

    // Reset filters
    resetButton.addEventListener('click', () => {
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        populateTable(groupsData);
    });
});
