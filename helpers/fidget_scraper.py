#!/usr/bin/env python3

import json
import requests
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
import logging
from datetime import datetime
import hashlib
import os
import time

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper.log'),
        logging.StreamHandler()
    ]
)

# Set urllib3 logging to WARNING to reduce noise
logging.getLogger('urllib3').setLevel(logging.WARNING)
logging.getLogger('selenium').setLevel(logging.WARNING)

@dataclass
class Fidget:
    """Structure for a single fidget variant"""
    name: str
    image: str
    dimensions: str
    weight: str
    material: List[str]
    button_size: str = "Not specified"  # Default argument must come last

class FidgetScraper:
    def __init__(self, config: dict):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Get script directory and project root
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(script_dir)
        
        # Set paths relative to project root
        self.data_file = os.path.join(project_root, config.get('data_file', 'data.json'))
        self.images_folder = os.path.join(project_root, config.get('images_folder', 'images'))
        
        self.logger.debug(f"Script directory: {script_dir}")
        self.logger.debug(f"Project root: {project_root}")
        self.logger.debug(f"Data file path: {self.data_file}")
        self.logger.debug(f"Images folder path: {self.images_folder}")
        
        self.ollama_url = config.get('ollama_url', 'http://10.10.0.10:11434/api/chat')
        self.ollama_model = config.get('ollama_model', 'llama3.2')
        self.setup_folders()

    def setup_folders(self):
        """Create necessary folders if they don't exist"""
        Path(self.images_folder).mkdir(parents=True, exist_ok=True)
        Path(self.data_file).parent.mkdir(parents=True, exist_ok=True)

    def get_driver(self):
        """Create a new selenium webdriver instance with proper options"""
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        return webdriver.Chrome(options=options)

    class PageLoadWaiter:
        def __init__(self, driver, timeout):
            self.driver = driver
            self.timeout = timeout
            self.old_page = None

        def __enter__(self):
            self.old_page = self.driver.find_element(By.TAG_NAME, "html")
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            try:
                WebDriverWait(self.driver, self.timeout).until(EC.staleness_of(self.old_page))
            except TimeoutException:
                pass
            return False  # Don't suppress exceptions

    def wait_for_page_load(self, driver, timeout=30):
        """Wait for the page to fully load"""
        return self.PageLoadWaiter(driver, timeout)

    def scrape_raw_data(self, url: str) -> Optional[Dict]:
        """Scrape raw data from the fidget page"""
        driver = None
        try:
            driver = self.get_driver()
            self.logger.debug(f"Navigating to URL: {url}")
            
            # Wait for page load
            with self.wait_for_page_load(driver, timeout=30):
                driver.get(url)
            
            # Wait longer for JavaScript to load and execute
            time.sleep(10)
            
            # Execute JavaScript to force load images
            driver.execute_script("""
                // Force load all images
                var images = document.getElementsByTagName('img');
                for(var i = 0; i < images.length; i++) {
                    var img = images[i];
                    if(img.getAttribute('data-src')) {
                        img.setAttribute('src', img.getAttribute('data-src'));
                    }
                    if(img.getAttribute('data-lazy-src')) {
                        img.setAttribute('src', img.getAttribute('data-lazy-src'));
                    }
                }
            """)
            
            # Scroll to trigger lazy loading
            for _ in range(3):
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight/3);")
                time.sleep(1)
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight*2/3);")
                time.sleep(1)
                driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(1)
                driver.execute_script("window.scrollTo(0, 0);")
            
            # Get all source code for debugging
            page_source = driver.page_source
            self.logger.debug(f"Page source length: {len(page_source)}")
            self.logger.debug("First 1000 characters of page source:")
            self.logger.debug(page_source[:1000])
            
            # Try to find all img elements and their attributes
            img_elements = driver.find_elements(By.TAG_NAME, "img")
            self.logger.debug(f"Found {len(img_elements)} img elements")
            for idx, img in enumerate(img_elements):
                try:
                    src = img.get_attribute("src")
                    data_src = img.get_attribute("data-src")
                    srcset = img.get_attribute("srcset")
                    classes = img.get_attribute("class")
                    style = img.get_attribute("style")
                    self.logger.debug(f"Image {idx + 1}:")
                    self.logger.debug(f"  src: {src}")
                    self.logger.debug(f"  data-src: {data_src}")
                    self.logger.debug(f"  srcset: {srcset}")
                    self.logger.debug(f"  class: {classes}")
                    self.logger.debug(f"  style: {style}")
                except Exception as e:
                    self.logger.debug(f"Error getting attributes for image {idx + 1}: {str(e)}")
            
            # Try multiple selectors for the title
            title = None
            selectors = [
                "h1.product_name",             # Common product name class
                "h1.product-title",            # Common product title
                ".product__title h1",          # Nested product title
                ".product-single__title",      # Shopify product title
                ".product_title",              # Alternative product title
                "#product-title",              # Product title by ID
                "#sections b",                 # Site-specific selector
                "h1"                           # Fallback to first h1
            ]
            
            for selector in selectors:
                try:
                    elements = driver.find_elements(By.CSS_SELECTOR, selector)
                    for element in elements:
                        potential_title = element.text.strip()
                        if (potential_title and
                            len(potential_title) > 3 and
                            not any(x in potential_title.lower() for x in ['cart', 'menu', 'search', 'login'])):
                            title = potential_title
                            break
                    if title:
                        break
                except:
                    continue

            # Try structured data if no title found
            if not title:
                try:
                    structured_data = driver.find_elements(By.CSS_SELECTOR, 'script[type="application/ld+json"]')
                    for data in structured_data:
                        try:
                            json_data = json.loads(data.get_attribute('innerHTML'))
                            if isinstance(json_data, dict) and 'name' in json_data:
                                potential_title = json_data['name']
                                if potential_title:
                                    title = potential_title
                                    break
                        except:
                            continue
                except:
                    pass

            if not title:
                # Fallback to page title
                title = driver.title.split(' - ')[0].split(' | ')[0].strip()
            
            # Try to find product images
            image_url = None
            
            # Look for structured data first
            try:
                structured_data = driver.find_elements(By.CSS_SELECTOR, 'script[type="application/ld+json"]')
                for data in structured_data:
                    try:
                        json_data = json.loads(data.get_attribute('innerHTML'))
                        if isinstance(json_data, dict):
                            if 'image' in json_data:
                                if isinstance(json_data['image'], list):
                                    image_url = json_data['image'][0]
                                else:
                                    image_url = json_data['image']
                                break
                    except:
                        continue
            except Exception as e:
                self.logger.debug(f"Structured data search failed: {str(e)}")

            # Try specific product image selectors
            if not image_url:
                product_selectors = [
                    ".product-single__media img[data-photoswipe-src]",
                    ".product-gallery__image img[data-zoom]",
                    ".product__photo img[data-zoom]",
                    "img.zoom-product",
                    ".product-single__photo img",
                    ".product__main-photos img",
                    "[data-product-single-media-wrapper] img",
                    ".product-gallery-image",
                ]

                for selector in product_selectors:
                    try:
                        elements = driver.find_elements(By.CSS_SELECTOR, selector)
                        for element in elements:
                            for attr in ['data-photoswipe-src', 'data-zoom', 'data-src', 'src']:
                                potential_url = element.get_attribute(attr)
                                if potential_url and potential_url.startswith('http'):
                                    if ('logo' not in potential_url.lower() and
                                        not potential_url.endswith(('.svg', '.gif')) and
                                        '/products/' in potential_url.lower()):
                                        image_url = potential_url
                                        break
                            if image_url:
                                break
                    except Exception as e:
                        self.logger.debug(f"Selector {selector} failed: {str(e)}")
                    if image_url:
                        break

            # If still no image found, try to find the largest non-logo image
            if not image_url:
                try:
                    largest_area = 0
                    image_elements = driver.find_elements(By.TAG_NAME, "img")
                    for img in image_elements:
                        try:
                            if img.is_displayed():
                                src = img.get_attribute("src")
                                if (src and 
                                    'logo' not in src.lower() and 
                                    not src.endswith(('.svg', '.gif'))):
                                    width = int(img.get_attribute("width") or 0)
                                    height = int(img.get_attribute("height") or 0)
                                    area = width * height
                                    if area > largest_area and area > 10000:  # Minimum size threshold
                                        largest_area = area
                                        image_url = src
                        except:
                            continue
                except Exception as e:
                    self.logger.debug(f"Fallback image search failed: {str(e)}")
            
            # Get product description
            description = ""
            desc_selectors = [
                "#introduction",  # Site-specific
                ".product-description",
                "#ProductDescription",
                "meta[name='description']"
            ]
            
            for selector in desc_selectors:
                try:
                    elements = driver.find_elements(By.CSS_SELECTOR, selector)
                    for element in elements:
                        if selector == "meta[name='description']":
                            content = element.get_attribute("content")
                        else:
                            content = element.text
                        if content:
                            description += content.strip() + " "
                except:
                    continue

            # Get all text content
            body_text = ""
            try:
                text_elements = driver.find_elements(By.CSS_SELECTOR, 'body *')
                for element in text_elements:
                    try:
                        if element.is_displayed():
                            text = element.text.strip()
                            if text:
                                body_text += text + " "
                    except:
                        continue
            except Exception as e:
                self.logger.error(f"Error getting body text: {str(e)}")
            
            raw_data = {
                "page_title": title or "Unknown Product",
                "raw_description": description.strip(),
                "image": image_url,
                "raw_content": body_text.strip(),
                "source_url": url
            }
            
            self.logger.debug(f"Scraped data: {json.dumps(raw_data, indent=2)}")
            return raw_data
            
        except WebDriverException as e:
            self.logger.error(f"WebDriver error for {url}: {str(e)}")
        except Exception as e:
            self.logger.error(f"Error scraping {url}: {str(e)}")
        finally:
            if driver:
                try:
                    driver.quit()
                except:
                    pass
        return None

    def verify_measurements(self, parsed_data: Dict, raw_data: Dict) -> Dict:
        """Verify and clean up measurements in the parsed data"""
        try:
            # Verify dimensions format
            if 'dimensions' in parsed_data:
                # Check if dimensions contain proper × character and units
                dims = parsed_data['dimensions']
                if not any(x in dims.lower() for x in ['mm', 'cm', 'in']):
                    dims += 'mm'  # Add mm if no unit specified
                if '×' not in dims and 'x' in dims:
                    dims = dims.replace('x', '×')
                parsed_data['dimensions'] = dims

            # Verify button size
            if 'button_size' in parsed_data:
                button = parsed_data['button_size']
                if button and button.lower() != 'not specified':  # Check if button size exists and isn't 'not specified'
                    if not any(x in button.lower() for x in ['mm', 'cm', 'in']):  # Check if unit is missing
                        button += 'mm'  # Add mm if no unit specified
                parsed_data['button_size'] = button

            # Verify weights in variants
            if 'variants' in parsed_data:
                for variant in parsed_data['variants']:
                    if 'weight' in variant:
                        weight = variant['weight']
                        if weight and weight.lower() != 'not specified':
                            if not any(x in weight.lower() for x in ['g', 'oz', 'kg']):
                                weight += 'g'
                            variant['weight'] = weight

            return parsed_data

        except Exception as e:
            self.logger.error(f"Error in measurement verification: {str(e)}")
            return parsed_data  # Return original data if verification fails

    def parse_with_ollama(self, raw_data: Dict, maker_name: str) -> Optional[List[Fidget]]:
        """Parse raw data using Ollama to extract fidget variants"""
        try:
            prompt = self.create_ollama_prompt(raw_data)
            
            # Add retry logic for Ollama API calls
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    response = requests.post(
                        self.ollama_url,
                        json={
                            "model": self.ollama_model,
                            "messages": [{"role": "user", "content": prompt}]
                        },
                        stream=True,
                        timeout=30  # Increased timeout
                    )
                    
                    if response.status_code == 200:
                        full_content = ""
                        for line in response.iter_lines():
                            if line:
                                try:
                                    json_response = json.loads(line.decode('utf-8'))
                                    if 'message' in json_response and 'content' in json_response['message']:
                                        full_content += json_response['message']['content']
                                except json.JSONDecodeError:
                                    continue

                        self.logger.debug(f"Full Ollama response:\n{full_content}")

                        # Extract JSON from response
                        json_match = re.search(r'\{[\s\S]*\}', full_content)
                        if not json_match:
                            self.logger.error("No JSON structure found in response")
                            if attempt < max_retries - 1:
                                time.sleep(2)  # Wait before retry
                                continue
                            return None
                        
                        try:
                            parsed_data = json.loads(json_match.group(0))
                        except json.JSONDecodeError as e:
                            self.logger.error(f"Failed to parse JSON from Ollama response: {str(e)}")
                            if attempt < max_retries - 1:
                                continue
                            return None

                        # Verify measurements before creating Fidget objects
                        verified_data = self.verify_measurements(parsed_data, raw_data)
                        
                        fidgets = []
                        for variant in verified_data.get('variants', []):
                            # Only process variants with both material and weight
                            if variant.get('material') and variant.get('weight'):
                                # Download image
                                image_path = None
                                if verified_data.get('image'):
                                    image_path = self.download_image(
                                        verified_data['image'],
                                        maker_name,
                                        f"{verified_data['name']}_{variant['material']}"
                                    )

                                # Create fidget object
                                fidget = Fidget(
                                    name=verified_data['name'].replace(' - ', ' ').title(),
                                    image=f"images/{image_path}" if image_path else verified_data.get('image', ''),
                                    dimensions=verified_data.get('dimensions', 'Not specified'),
                                    weight=variant.get('weight', 'Not specified'),
                                    material=[variant.get('material', 'Not specified')],
                                    button_size=verified_data.get('button_size', 'Not specified')
                                )
                                fidgets.append(fidget)
                        
                        return fidgets

                except requests.RequestException as e:
                    self.logger.error(f"Request error with Ollama (attempt {attempt + 1}): {str(e)}")
                    if attempt < max_retries - 1:
                        time.sleep(2)  # Wait before retry

        except Exception as e:
            self.logger.error(f"Error parsing with Ollama: {str(e)}")
        return None

    def create_ollama_prompt(self, raw_data: Dict) -> str:
        """Create a structured prompt for Ollama"""
        # Extract the description for better context
        desc = raw_data.get('raw_description', '')
        page_title = raw_data.get('page_title', '')
        
        # Try to extract variant information from the title
        variant_info = page_title.split(' - ')[1] if ' - ' in page_title else ''
        
        return (
            "You are a JSON generator. Extract EXACT product information from the provided text. "
            "Return ONLY a JSON object starting with '{' and ending with '}'. No other text.\n\n"
            f"Product title: {page_title}\n"
            f"Description text: {desc}\n\n"
            "Required JSON structure (MATCH EXACTLY):\n"
            "{\n"
            '  "name": "Product Name",\n'
            '  "dimensions": "Length×Width×Height" (use × character, include mm),\n'
            f'  "image": "{raw_data.get("image", "")}",\n'
            '  "button_size": "XXmm",\n'
            '  "variants": [\n'
            '    {\n'
            '      "material": "material_name",\n'
            '      "weight": "weight_in_g"\n'
            '    }\n'
            '  ]\n'
            "}\n\n"
            "STRICT RULES:\n"
            "1. Extract EXACT measurements from text\n"
            "2. Use × character between dimensions\n"
            "3. Include units (mm, g)\n"
            "4. Keep original precision\n"
            "5. Include ALL measurements found\n"
            "6. Do NOT invent or estimate values"
        )

    def download_image(self, url: str, maker_name: str, product_name: str) -> Optional[str]:
        """Download and save image, return local path"""
        try:
            # First find the maker's image folder from data.json
            with open(self.data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            maker_folder = None
            for group in data.get('groups', []):
                if group.get('name') == maker_name:
                    # Extract folder from group's image path
                    group_image_path = group.get('image', '')
                    if group_image_path:
                        parts = group_image_path.split('/')
                        if len(parts) >= 2:
                            maker_folder = parts[1]
                            break

            if not maker_folder:
                self.logger.error(f"Could not determine image folder for maker {maker_name}")
                return None

            # Handle different URL formats
            if url.startswith('//'):
                url = 'https:' + url
            elif not url.startswith(('http://', 'https://')):
                url = 'https://' + url.lstrip('/')

            # Download image with retries
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    response = requests.get(url, timeout=10)
                    if response.status_code == 200:
                        # Use the found maker folder
                        full_maker_folder = os.path.join(self.images_folder, maker_folder)
                        os.makedirs(full_maker_folder, exist_ok=True)

                        # Create filename with product name and material
                        safe_product = re.sub(r'[^\w\-_.]', '_', product_name.lower())
                        filename = f"{safe_product}.jpg"
                        filepath = os.path.join(full_maker_folder, filename)
                        
                        with open(filepath, 'wb') as f:
                            f.write(response.content)
                        
                        return os.path.join(maker_folder, filename)
                    else:
                        self.logger.warning(f"Failed to download image (attempt {attempt + 1}), status code: {response.status_code}")
                except requests.RequestException as e:
                    if attempt == max_retries - 1:
                        self.logger.error(f"Failed all attempts to download image from {url}: {str(e)}")
                    time.sleep(1)  # Wait before retry

        except Exception as e:
            self.logger.error(f"Failed to download image from {url}: {str(e)}")
        return None

    def update_maker_data(self, maker_name: str, fidgets: List[Fidget]) -> bool:
        """Update the JSON file with new fidget data for a maker"""
        try:
            # Load existing data
            with open(self.data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            # Debug the structure
            self.logger.debug(f"Found {len(data.get('groups', []))} groups in data")
            
            # Find the maker in the groups array
            maker_found = False
            for group in data.get('groups', []):
                self.logger.debug(f"Checking group: {group.get('name')}")
                if group.get('name') == maker_name:
                    maker_found = True
                    self.logger.debug(f"Found maker {maker_name}")
                    
                    # Convert Fidget objects to dictionaries and clean up the data
                    new_fidgets = []
                    for fidget in fidgets:
                        fidget_dict = asdict(fidget)
                        new_fidgets.append(fidget_dict)
                    
                    # Initialize or update fidgets array
                    if 'fidgets' not in group:
                        group['fidgets'] = []
                    group['fidgets'].extend(new_fidgets)
                    break

            if not maker_found:
                available_makers = [group.get('name') for group in data.get('groups', [])]
                self.logger.warning(
                    f"Maker '{maker_name}' not found in groups. "
                    f"Available makers: {available_makers}"
                )
                return False

            # Save updated data
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            self.logger.info(f"Successfully updated {maker_name} with {len(fidgets)} new fidgets")
            return True

        except Exception as e:
            self.logger.error(f"Error updating maker data: {str(e)}")
            self.logger.exception("Detailed error:")
            return False

    def process_url(self, url: str, maker_name: str) -> bool:
        """Process a single URL for a specific maker"""
        try:
            self.logger.info(f"Processing {url} for {maker_name}")
            raw_data = self.scrape_raw_data(url)
            if raw_data:
                fidgets = self.parse_with_ollama(raw_data, maker_name)
                if fidgets:
                    return self.update_maker_data(maker_name, fidgets)
        except Exception as e:
            self.logger.error(f"Error processing {url}: {str(e)}")
        return False

    def process_urls(self, urls: List[Dict[str, List[str]]]):
        """Process multiple URLs with their associated maker names"""
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = []
            total_urls = sum(len(maker_data['urls']) for maker_data in urls)
            
            for maker_data in urls:
                maker = maker_data['maker']
                for url in maker_data['urls']:
                    futures.append(
                        executor.submit(
                            self.process_url,
                            url,
                            maker
                        )
                    )
            
            successful = sum(1 for future in futures if future.result())
            self.logger.info(f"Successfully processed {successful} out of {total_urls} URLs")

def main():
    # Configuration
    config = {
        'data_file': 'data.json',
        'images_folder': 'images',
        'ollama_url': 'http://$LLAMAHOST:11434/api/chat',
        'ollama_model': 'llama3.2'
    }
    
    # URLs with their associated makers
    urls = [
        {
            'maker': '$MAKER',  
            'urls': [
                '$URL1',
                '$URL2'
            ]
        }
    ]
    
    scraper = FidgetScraper(config)
    scraper.process_urls(urls)

if __name__ == "__main__":
    main()