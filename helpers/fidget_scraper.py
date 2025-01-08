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
from selenium.common.exceptions import TimeoutException
import logging
from datetime import datetime
import hashlib
import os

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

class FidgetScraper:
    def __init__(self, config: dict):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.data_file = config.get('data_file', 'data.json')
        self.images_folder = config.get('images_folder', 'images')
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
        return webdriver.Chrome(options=options)

    def download_image(self, url: str, maker_name: str, product_name: str) -> Optional[str]:
        """Download and save image, return local path"""
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                # Create maker-specific subfolder
                maker_folder = os.path.join(self.images_folder, re.sub(r'[^\w\-_.]', '_', maker_name.lower()))
                os.makedirs(maker_folder, exist_ok=True)

                # Create unique filename
                url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
                safe_name = re.sub(r'[^\w\-_.]', '_', product_name.lower())
                filename = f"{safe_name}_{url_hash}.jpg"
                filepath = os.path.join(maker_folder, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(response.content)
                
                # Return relative path from images folder
                return os.path.join(maker_name.lower(), filename)
        except Exception as e:
            self.logger.error(f"Failed to download image from {url}: {str(e)}")
        return None

    def scrape_raw_data(self, url: str) -> Optional[Dict]:
        """Scrape raw data from the fidget page"""
        driver = None
        try:
            driver = self.get_driver()
            driver.get(url)
            wait = WebDriverWait(driver, 10)

            # Wait for critical elements
            title_element = wait.until(EC.presence_of_element_located((By.TAG_NAME, "h1")))
            
            raw_data = {
                "page_title": title_element.text.strip(),
                "raw_description": driver.find_element(By.CSS_SELECTOR, "meta[name='description']").get_attribute("content"),
                "image": driver.find_element(By.CSS_SELECTOR, "img").get_attribute("src"),
                "raw_content": driver.find_element(By.TAG_NAME, "body").text,
                "source_url": url
            }
            return raw_data
        except Exception as e:
            self.logger.error(f"Error scraping {url}: {str(e)}")
        finally:
            if driver:
                driver.quit()
        return None

    def parse_with_ollama(self, raw_data: Dict, maker_name: str) -> Optional[List[Fidget]]:
        """Parse raw data using Ollama to extract fidget variants"""
        try:
            prompt = self.create_ollama_prompt(raw_data)
            response = requests.post(
                self.ollama_url,
                json={
                    "model": self.ollama_model,
                    "messages": [{"role": "user", "content": prompt}]
                },
                stream=True,
                timeout=10
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
                    return None
                
                parsed_data = json.loads(json_match.group(0))
                fidgets = []

                for variant in parsed_data.get('variants', []):
                    # Clean up and extract dimensions
                    dimensions = parsed_data.get('dimensions', '')
                    spinning_diameter_match = re.search(r'Spinning Diameter:\s*(\d+\s*mm)', dimensions)
                    if spinning_diameter_match:
                        dimensions = f"Spinning Diameter: {spinning_diameter_match.group(1)}"
                    elif 'x' in dimensions:
                        # If there are full dimensions, extract just the first instance
                        dimensions_match = re.search(r'(\d+x\d+x\d+mm)', dimensions)
                        if dimensions_match:
                            dimensions = dimensions_match.group(1)

                    # Download image for each variant
                    image_path = self.download_image(
                        parsed_data['image'],
                        maker_name,
                        f"{parsed_data['name']}_{variant['material']}"
                    )

                    fidget = Fidget(
                        name=parsed_data['name'].replace(' - ', ' ').title(),
                        image=f"images/{image_path}" if image_path else parsed_data['image'],
                        dimensions=dimensions or 'Not specified',
                        weight=variant.get('weight', 'Not specified'),
                        material=[variant.get('material', 'Not specified')]
                    )
                    fidgets.append(fidget)

                return fidgets

        except Exception as e:
            self.logger.error(f"Error parsing with Ollama: {str(e)}")
        return None

    def create_ollama_prompt(self, raw_data: Dict) -> str:
        """Create a structured prompt for Ollama"""
        return (
            "Return ONLY a raw JSON object with no additional text, explanations, or markdown formatting. "
            "The response must start with '{' and end with '}' with no other characters before or after. "
            "Look carefully for dimensions in any format, including:\n"
            "- Full dimensions (e.g., '50x20x10mm')\n"
            "- Spinning diameter (e.g., 'Spinning Diameter: 47 mm')\n"
            "- Any other dimension format\n\n"
            "Required structure:\n"
            "{\n"
            "  \"name\": \"Product Name\",\n"
            "  \"dimensions\": \"ALL found dimensions, including spinning diameter if available\",\n"
            "  \"image\": \"image_url\",\n"
            "  \"variants\": [\n"
            "    {\n"
            "      \"material\": \"material name\",\n"
            "      \"weight\": \"weight in grams\"\n"
            "    }\n"
            "  ]\n"
            "}\n\n"
            "Important:\n"
            "1. Extract ALL variants with their specific weights and materials\n"
            "2. Include ALL dimension information found, especially spinning diameter\n"
            "3. Return ONLY the JSON object with no additional text or formatting\n\n"
            f"Raw webpage data:\n{json.dumps(raw_data, indent=2)}"
        )

    def update_maker_data(self, maker_name: str, fidgets: List[Fidget]):
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
                        # Clean up weight strings
                        if isinstance(fidget_dict.get('weight'), str):
                            fidget_dict['weight'] = fidget_dict['weight'].replace('+/- ', '').replace('grams', '').strip()
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

    def process_urls(self, urls: List[Dict[str, str]]):
        """Process multiple URLs with their associated maker names"""
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = []
            for url_data in urls:
                futures.append(
                    executor.submit(
                        self.process_url,
                        url_data['url'],
                        url_data['maker']
                    )
                )
            
            successful = sum(1 for future in futures if future.result())
            self.logger.info(f"Successfully processed {successful} out of {len(urls)} URLs")

def main():
    # Configuration
    config = {
        'data_file': 'data.json',
        'images_folder': 'images',
        'ollama_url': 'http://$HOST:11434/api/chat',
        'ollama_model': 'llama3.2'
    }
    
    # Example URLs with their associated makers
    urls = [
        {
            'maker': '$GROUP',  # Must match exactly the name in data.json
            'url': '$URL'
        }
    ]
    
    scraper = FidgetScraper(config)
    scraper.process_urls(urls)

if __name__ == "__main__":
    main()