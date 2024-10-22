// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Filter and Table Elements
    const checkboxes = document.querySelectorAll('.filter-checkbox');
    const tableBody = document.querySelector('#groupsTable tbody');
    const resetButton = document.getElementById('resetFilters');

    let groupsData = [];

    // Function to shuffle an array using the Fisher-Yates algorithm
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            // Generate a random index from 0 to i
            const j = Math.floor(Math.random() * (i + 1));
            // Swap elements at indices i and j
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Fetch data from data.json
    fetch('data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Shuffle the groups data before storing
            groupsData = shuffleArray(data.groups);
            populateTable(groupsData);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load data.</td></tr>';
        });

    // Function to populate the table with group data
    function populateTable(data) {
        tableBody.innerHTML = ''; // Clear existing data

        if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No groups found.</td></tr>';
            return;
        }

        data.forEach(group => {
            const row = document.createElement('tr');

            // Image Cell
            const imgCell = document.createElement('td');
            const img = document.createElement('img');
            img.src = group.image;
            img.alt = group.name;
            img.classList.add('img-thumbnail');
            img.width = 100;
            img.onerror = () => {
                img.src = 'images/default.jpg'; // Fallback image
                console.warn(`Image not found: ${group.image}. Using fallback image.`);
            };
            imgCell.appendChild(img);
            row.appendChild(imgCell);

            // Group Name Cell
            const nameCell = document.createElement('td');
            nameCell.textContent = group.name;
            row.appendChild(nameCell);

            // Description Cell
            const descCell = document.createElement('td');
            descCell.textContent = group.description;
            row.appendChild(descCell);

            // Link Cell
            const linkCell = document.createElement('td');
            const link = document.createElement('a');
            link.href = group.link;
            link.textContent = 'Visit Group';
            link.target = '_blank';
            link.rel = 'noopener noreferrer'; // Security best practice
            link.classList.add('btn', 'btn-primary', 'btn-sm');
            linkCell.appendChild(link);
            row.appendChild(linkCell);

            // Categories Cell
            const catCell = document.createElement('td');
            catCell.textContent = group.categories.join(', ');
            row.appendChild(catCell);

            // Append the row to the table body
            tableBody.appendChild(row);
        });
    }

    // Function to filter the table based on selected categories
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

    // Attach event listeners to each checkbox to trigger filtering
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', filterTable);
    });

    // Event listener for the "Reset Filters" button to clear all selections
    resetButton.addEventListener('click', () => {
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        populateTable(groupsData);
    });
});
