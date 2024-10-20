# Contributing to The Fidget List

First off, thank you for considering contributing to **The Fidget List**! 🎉 Your help is greatly appreciated and vital to the continued improvement of this project.

The following guidelines aim to make the process smooth and efficient for everyone involved.

## Table of Contents

- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Adding a New Group](#adding-a-new-group)
- [Pull Requests](#pull-requests)
  - [Style Guide](#style-guide)
  - [Commit Messages](#commit-messages)
- [Development Setup](#development-setup)
- [Questions](#questions)



## How Can I Contribute?

### Reporting Bugs

If you find a bug in **The Fidget List**, please follow these steps to report it:

1. **Search Existing Issues:** Before creating a new issue, check if the bug has already been reported.
2. **Create a New Issue:**
   - Go to the [Issues](https://github.com/thinkjk/the-fidget-list/issues) section of the repository.
   - Click on **"New Issue"**.
   - Provide a clear and descriptive title.
   - Describe the bug in detail, including steps to reproduce it.
   - If applicable, include screenshots or error messages.

### Suggesting Enhancements

Enhancing **The Fidget List** to better serve its users is always welcome. Here's how you can suggest improvements:

1. **Check Existing Enhancements:** Review current issues to see if your suggestion is already being discussed.
2. **Create a New Issue:**
   - Navigate to the [Issues](https://github.com/thinkjk/the-fidget-list/issues) section.
   - Click on **"New Issue"** and select **"Feature Request"** if applicable.
   - Clearly describe the enhancement you'd like to see.
   - Explain why it would be beneficial.

### Adding a New Group

To expand the directory with new Facebook fidget groups, follow these guidelines:

1. **Fork the Repository:**
   - Click on the **"Fork"** button at the top right of the repository page to create your own copy.

2. **Clone Your Fork:**

    ```bash
    git clone https://github.com/thinkjk/the-fidget-list.git
    cd the-fidget-list
    ```

3. **Create a New Branch:**

    ```bash
    git checkout -b add-new-group
    ```

4. **Add the New Group to `data.json`:**
   - Open `data.json` in a text editor.
   - Add a new group object to the `"groups"` array following the existing structure.

    ```json
    {
        "name": "Group Name",
        "description": "A brief description of the group.",
        "link": "https://www.facebook.com/groups/groupname",
        "image": "images/group_image.jpg",
        "categories": ["Category1", "Category2"]
    }
    ```

5. **Add the Group Image:**
   - Place the corresponding image in the `images/` folder.
   - Ensure the image file name matches the `"image"` field in `data.json`.

6. **Commit Your Changes:**

    ```bash
    git add data.json images/group_image.jpg
    git commit -m "Add new group: Group Name"
    ```

7. **Push to Your Fork:**

    ```bash
    git push origin add-new-group
    ```

8. **Create a Pull Request:**
   - Go to your forked repository on GitHub.
   - Click on **"Compare & pull request"**.
   - Provide a clear description of the group you're adding.
   - Submit the pull request.

## Pull Requests

Contributions through pull requests (PRs) are welcome. Here's how to ensure your PR is processed smoothly:

### Style Guide

- **Consistency:** Follow the existing code style and formatting.
- **Clarity:** Ensure that your code is clear and well-documented.
- **Functionality:** Verify that your changes work as intended and do not introduce new bugs.

### Commit Messages

- **Descriptive:** Use clear and descriptive commit messages.
- **Format:** Follow the conventional commit format (optional but recommended).

    ```plaintext
    feat: Add new group "Group Name"

    fix: Correct image path for "Group Name"

    docs: Update README with installation instructions
    ```

## Development Setup

To set up the project locally for development and testing, follow these steps:

1. **Clone the Repository:**

    ```bash
    git clone https://github.com/thinkjk/the-fidget-list.git
    cd the-fidget-list
    ```

2. **Install Dependencies:**

    - Since this is a static site, there may not be any dependencies. If using any build tools or preprocessors, install them as per the project's needs.

3. **Start a Local Server:**

    Using Python 3:

    ```bash
    python3 -m http.server 8000
    ```

    Or using Node.js:

    ```bash
    npx http-server
    ```

4. **Access the Project:**

    Open your browser and navigate to `http://localhost:8000` to view the site locally.

## Questions

If you have any questions or need further assistance, feel free to reach out:

- **GitHub Issues:** [https://github.com/thinkjk/the-fidget-list/issues](https://github.com/thinkjk/the-fidget-list/issues)
