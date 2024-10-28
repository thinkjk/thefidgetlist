// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const checkboxesContainer = document.getElementById('filtersContainer');
    const checkboxes = () => document.querySelectorAll('.filter-checkbox');
    const tableBody = document.querySelector('#groupsTable tbody');
    const resetButton = document.getElementById('resetFilters');

    let groupsData = [];
    let filtersData = [];

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
            // Store filters and groups data
            filtersData = data.filters;
            groupsData = shuffleArray(data.groups);
            generateFilters(filtersData);
            attachCheckboxListeners(); // Attach listeners after generating filters
            populateTable(groupsData);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load data.</td></tr>';
        });

    // Function to generate filter checkboxes dynamically
    function generateFilters(filters) {
        checkboxesContainer.innerHTML = ''; // Clear existing filters if any

        filters.forEach(filter => {
            // Create column div
            const colDiv = document.createElement('div');
            colDiv.classList.add('col-6', 'col-sm-4', 'col-md-3', 'mb-3');

            // Create form-check div
            const formCheckDiv = document.createElement('div');
            formCheckDiv.classList.add('form-check');

            // Create checkbox input
            const checkbox = document.createElement('input');
            checkbox.classList.add('form-check-input', 'filter-checkbox');
            checkbox.type = 'checkbox';
            checkbox.value = filter;
            checkbox.id = `filter${filter.replace(/\s+/g, '')}`; // Remove spaces for ID

            // Create label
            const label = document.createElement('label');
            label.classList.add('form-check-label');
            label.htmlFor = checkbox.id;
            label.textContent = filter;

            // Append checkbox and label to form-check div
            formCheckDiv.appendChild(checkbox);
            formCheckDiv.appendChild(label);

            // Append form-check div to column div
            colDiv.appendChild(formCheckDiv);

            // Append column div to container
            checkboxesContainer.appendChild(colDiv);
        });
    }

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
            catCell.classList.add('categories-column'); // Add the class here
            catCell.textContent = group.categories.join(', ');
            row.appendChild(catCell);

            // Append the row to the table body
            tableBody.appendChild(row);
        });
    }

    // Function to filter the table based on selected categories
    function filterTable() {
        const selectedCategories = Array.from(checkboxes())
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

    // Attach event listeners to dynamically generated checkboxes
    function attachCheckboxListeners() {
        const allCheckboxes = checkboxes();
        allCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', filterTable);
        });
    }

    // Event listener for the "Reset Filters" button to clear all selections
    resetButton.addEventListener('click', () => {
        Array.from(checkboxes()).forEach(checkbox => {
            checkbox.checked = false;
        });
        populateTable(groupsData);
    });
});
