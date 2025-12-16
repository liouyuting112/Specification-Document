#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
圖片下載工具 - 根據Markdown描述檔從網路搜尋並下載無版權圖片
支援Pexels API，自動轉換為WebP格式
"""

import os
import re
import json
import sys
import time
import base64
from pathlib import Path
import requests
from PIL import Image
import io
import hashlib

# GUI相關（可選）
try:
    import tkinter as tk
    from tkinter import filedialog, messagebox
    GUI_AVAILABLE = True
except ImportError:
    GUI_AVAILABLE = False

class ImageGenerator:
    def __init__(self):
        self.config = self.load_config()
        self.generated_images = {}  # 記錄已生成的圖片（根據描述）
        self.used_image_urls = set()  # 記錄已使用的圖片URL，避免重複
        self.used_image_hashes = set()  # 記錄已使用的圖片hash，避免重複
        
    def load_config(self):
        """載入配置"""
        config_file = 'image_downloader_config.json'
        if os.path.exists(config_file):
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            default_config = {
                "output_dir": "downloaded_images",
                "skip_existing": True,
                "max_file_size_kb": 100,
                "webp_quality": 85,
                "delay_between_requests": 2.0,
                "google_api_key": "",
                "imagen_model": "imagegeneration@006"  # Google的Imagen模型
            }
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, ensure_ascii=False, indent=2)
            print(f"已創建配置檔: {config_file}")
            print("請編輯配置檔設定Google AI Studio API Key")
            return default_config
    
    def parse_markdown(self, file_path):
        """解析Markdown描述檔，提取圖片資訊"""
        images = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 支援多種格式：
        # 格式1: - **檔名**: xxx.webp ... - **生成指令**: xxx (列表格式，可選用途)
        # 格式2: ### 檔名.webp ... **描述**: xxx ... **AI生成指令**: xxx (標題格式，可選用途)
        # 格式3: ### 檔名.webp ... **AI生成指令**: xxx (只有指令，沒有描述)
        
        # 先嘗試格式1（列表格式，帶用途）
        pattern1_with_purpose = r'-\s*\*\*檔名\*\*:\s*([^\n]+\.webp)\s*\n[^\n]*\*\*用途\*\*:\s*([^\n]+)\s*\n[^\n]*\*\*描述\*\*:\s*([^\n]+)\s*\n[^\n]*\*\*(?:生成指令|AI生成指令|AI指令|指令)\*\*:\s*([^\n]+)'
        matches1 = re.findall(pattern1_with_purpose, content, re.MULTILINE)
        
        for match in matches1:
            filename = match[0].strip()
            purpose = match[1].strip()
            description = match[2].strip()
            prompt = match[3].strip()
            
            images.append({
                'filename': filename,
                'purpose': purpose,
                'description': description,
                'prompt': prompt
            })
        
        # 格式1變體（列表格式，無用途）
        if not images:
            pattern1_no_purpose = r'-\s*\*\*檔名\*\*:\s*([^\n]+\.webp)\s*\n[^\n]*\*\*描述\*\*:\s*([^\n]+)\s*\n[^\n]*\*\*(?:生成指令|AI生成指令|AI指令|指令)\*\*:\s*([^\n]+)'
            matches1_no_purpose = re.findall(pattern1_no_purpose, content, re.MULTILINE)
            
            for match in matches1_no_purpose:
                filename = match[0].strip()
                description = match[1].strip()
                prompt = match[2].strip()
                
                images.append({
                    'filename': filename,
                    'purpose': '網站圖片',
                    'description': description,
                    'prompt': prompt
                })
        
        # 格式2（標題格式，帶用途）
        if not images:
            pattern2_with_purpose = r'###\s+([^\n]+\.webp)\s*\n\*\*用途\*\*:\s*([^\n]+)\s*\n\*\*描述\*\*:\s*([^\n]+)\s*\n\*\*(?:生成指令|AI生成指令|AI指令|指令)\*\*:\s*([^\n]+)'
            matches2 = re.findall(pattern2_with_purpose, content, re.MULTILINE)
            
            for match in matches2:
                filename = match[0].strip()
                purpose = match[1].strip()
                description = match[2].strip()
                prompt = match[3].strip()
                
                images.append({
                    'filename': filename,
                    'purpose': purpose,
                    'description': description,
                    'prompt': prompt
                })
        
        # 格式2變體（標題格式，無用途，有描述）
        if not images:
            # 匹配 ### 檔名.webp 後面跟著 **描述**: 和 **AI生成指令**: (順序固定)
            pattern2_no_purpose = r'###\s+([^\n]+\.webp)\s*\n\*\*描述\*\*:\s*([^\n]+)\s*\n\*\*(?:生成指令|AI生成指令|AI指令|指令)\*\*:\s*([^\n]+)'
            matches2_no_purpose = re.findall(pattern2_no_purpose, content, re.MULTILINE)
            
            for match in matches2_no_purpose:
                filename = match[0].strip()
                description = match[1].strip()
                prompt = match[2].strip()
                
                images.append({
                    'filename': filename,
                    'purpose': '網站圖片',
                    'description': description,
                    'prompt': prompt
                })
        
        # 格式3（標題格式，只有AI生成指令，沒有描述）
        if not images:
            pattern3_only_prompt = r'###\s+([^\n]+\.webp)\s*\n\*\*(?:生成指令|AI生成指令|AI指令|指令)\*\*:\s*([^\n]+)'
            matches3 = re.findall(pattern3_only_prompt, content, re.MULTILINE)
            
            for match in matches3:
                filename = match[0].strip()
                prompt = match[1].strip()
                
                # 從提示詞中提取描述（清理後的提示詞作為描述）
                description = self.clean_prompt(prompt)
                
                images.append({
                    'filename': filename,
                    'purpose': '網站圖片',
                    'description': description,
                    'prompt': prompt
                })
        
        # 如果還是沒有匹配到，嘗試更寬鬆的格式（允許空行和額外內容）
        if not images:
            # 使用更靈活的正則，匹配 ### 檔名 後面跟著 **描述** 和 **AI生成指令**（允許中間有空行）
            pattern_flexible = r'###\s+([^\n]+\.webp)\s*\n(?:[^\n]*\n)*?\*\*描述\*\*:\s*([^\n]+)\s*\n(?:[^\n]*\n)*?\*\*(?:生成指令|AI生成指令|AI指令|指令)\*\*:\s*([^\n]+)'
            matches_flexible = re.findall(pattern_flexible, content, re.MULTILINE)
            
            for match in matches_flexible:
                filename = match[0].strip()
                description = match[1].strip()
                prompt = match[2].strip()
                
                images.append({
                    'filename': filename,
                    'purpose': '網站圖片',
                    'description': description,
                    'prompt': prompt
                })
        
        # 最後嘗試：只有AI生成指令的情況（更寬鬆）
        if not images:
            pattern_flexible_prompt = r'###\s+([^\n]+\.webp)\s*\n(?:[^\n]*\n)*?\*\*(?:生成指令|AI生成指令|AI指令|指令)\*\*:\s*([^\n]+)'
            matches_flexible_prompt = re.findall(pattern_flexible_prompt, content, re.MULTILINE)
            
            for match in matches_flexible_prompt:
                filename = match[0].strip()
                prompt = match[1].strip()
                
                # 從提示詞中提取描述
                description = self.clean_prompt(prompt)
                
                images.append({
                    'filename': filename,
                    'purpose': '網站圖片',
                    'description': description,
                    'prompt': prompt
                })
        
        return images
    
    def clean_prompt(self, prompt):
        """清理提示詞，移除不需要的參數"""
        # 移除 --ar 16:9 等參數
        prompt = re.sub(r'--ar\s+\d+:\d+', '', prompt).strip()
        prompt = re.sub(r'--\w+\s+[^\s]+', '', prompt).strip()
        # 移除多餘空白
        prompt = ' '.join(prompt.split())
        return prompt
    
    def generate_image_with_imagen(self, prompt, description):
        """使用Google Imagen API生成圖片"""
        api_key = self.config.get('google_api_key', '')
        model = self.config.get('imagen_model', 'imagegeneration@006')
        
        if not api_key:
            raise ValueError("Google API Key未設定，請在image_downloader_config.json中設定")
        
        # 清理提示詞
        clean_prompt_text = self.clean_prompt(prompt)
        
        # Google Imagen API 端點
        # 方法1: 使用 Vertex AI Imagen API
        url = f"https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT/locations/us-central1/publishers/google/models/{model}:predict"
        
        # 方法2: 使用 Gemini API 的圖片生成功能（如果可用）
        # 方法3: 使用 Imagen 3 API（推薦）
        
        # 嘗試使用 Imagen 3 API（通過 Vertex AI）
        # 注意：需要正確的項目ID和位置
        try:
            # 使用簡化的API調用方式
            # Google AI Studio 可能使用不同的端點
            imagen_url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages"
            
            payload = {
                "prompt": clean_prompt_text,
                "numberOfImages": 1,
                "aspectRatio": "16:9",
                "safetyFilterLevel": "block_some",
                "personGeneration": "allow_all"
            }
            
            headers = {
                "Content-Type": "application/json",
                "x-goog-api-key": api_key
            }
            
            print(f"  → 發送生成請求到Google Imagen API...")
            print(f"  → 提示詞: {clean_prompt_text[:80]}...")
            
            response = requests.post(imagen_url, json=payload, headers=headers, timeout=120)
            
            if response.status_code == 200:
                result = response.json()
                
                # 解析響應
                if 'generatedImages' in result and len(result['generatedImages']) > 0:
                    image_data_base64 = result['generatedImages'][0].get('imageBytes')
                    if image_data_base64:
                        image_data = base64.b64decode(image_data_base64)
                        image = Image.open(io.BytesIO(image_data))
                        print(f"  → 圖片生成成功")
                        return image
                
                # 嘗試其他響應格式
                if 'images' in result and len(result['images']) > 0:
                    image_data_base64 = result['images'][0].get('base64')
                    if image_data_base64:
                        image_data = base64.b64decode(image_data_base64)
                        image = Image.open(io.BytesIO(image_data))
                        print(f"  → 圖片生成成功")
                        return image
                
                raise Exception(f"API返回的結果格式不正確: {result}")
            else:
                error_text = response.text
                raise Exception(f"API請求失敗 (狀態碼: {response.status_code}): {error_text}")
                
        except requests.exceptions.RequestException as e:
            # 如果上面的方法失敗，嘗試使用 Vertex AI 方式
            try:
                print(f"  → 嘗試使用Vertex AI方式...")
                return self.generate_image_with_vertex_ai(clean_prompt_text, api_key, model)
            except Exception as e2:
                raise Exception(f"所有API方法都失敗: {str(e)} / {str(e2)}")
    
    def generate_image_with_vertex_ai(self, prompt, api_key, model):
        """使用Vertex AI方式生成圖片（備用方法）"""
        # 注意：這需要正確的項目ID
        # 這裡使用一個通用的方式
        
        # 嘗試使用 Gemini API 的圖片生成（如果支援）
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent"
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": f"Generate an image based on this description: {prompt}"
                }]
            }]
        }
        
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": api_key
        }
        
        # 注意：Gemini 可能不直接支援圖片生成
        # 這裡只是作為備用嘗試
        raise Exception("Vertex AI方式需要正確的項目配置，請使用Imagen API")
    
    def generate_image_with_imagen_simple(self, prompt, api_key):
        """使用簡化的Imagen API調用（如果標準方法失敗）"""
        # 嘗試不同的API端點
        endpoints = [
            "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages",
            "https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT/locations/us-central1/publishers/google/models/imagegeneration@006:predict",
        ]
        
        clean_prompt_text = self.clean_prompt(prompt)
        
        payload = {
            "prompt": clean_prompt_text,
            "numberOfImages": 1,
            "aspectRatio": "16:9"
        }
        
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": api_key
        }
        
        for endpoint in endpoints:
            try:
                print(f"  → 嘗試端點: {endpoint[:60]}...")
                response = requests.post(endpoint, json=payload, headers=headers, timeout=120)
                
                if response.status_code == 200:
                    result = response.json()
                    
                    # 嘗試解析不同的響應格式
                    if 'generatedImages' in result:
                        image_data_base64 = result['generatedImages'][0].get('imageBytes')
                        if image_data_base64:
                            image_data = base64.b64decode(image_data_base64)
                            return Image.open(io.BytesIO(image_data))
                    
                    if 'images' in result:
                        image_data_base64 = result['images'][0].get('base64')
                        if image_data_base64:
                            image_data = base64.b64decode(image_data_base64)
                            return Image.open(io.BytesIO(image_data))
            except:
                continue
        
        raise Exception("所有API端點都失敗")
    
    def extract_search_keywords(self, description, prompt):
        """從描述和提示詞中提取搜索關鍵字，通用方法，適用於所有主題"""
        keywords = []
        core_keywords = []  # 核心關鍵字（最重要）
        
        # 方法1: 優先從英文提示詞中提取（通常更準確）
        clean_prompt = re.sub(r'--ar\s+\d+:\d+', '', prompt).strip()
        clean_prompt = re.sub(r'--\w+\s+[^\s]+', '', clean_prompt).strip()
        
        # 停用詞列表（修飾詞、風格詞等）
        stop_words = ['professional', 'photography', 'style', 'natural', 'lighting', 
                     'high', 'quality', 'detailed', 'warm', 'cozy', 'atmosphere',
                     'setting', 'scene', 'beautiful', 'elegant', 'sophisticated',
                     'display', 'arranged', 'neatly', 'showing', 'presented',
                     'modern', 'clean', 'minimalist', 'soft', 'bright', 'glowing',
                     'mystical', 'ethereal', 'cosmic', 'design', 'background']
        
        # 核心主題詞（這些詞應該優先使用）
        core_theme_words = {
            # 星座相關
            'constellation', 'zodiac', 'astrology', 'astrologer', 'star', 'stars', 'starry',
            'planet', 'planetary', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
            'astronomy', 'astronomical', 'celestial', 'cosmic', 'galaxy', 'universe',
            'night', 'sky', 'night sky', 'twinkling', 'twinkle',
            # 3C相關
            'smartphone', 'phone', 'laptop', 'tablet', 'headphones', 'charger', 'watch',
            'computer', 'device', 'electronics', 'tech', 'technology', 'digital',
            # 寵物相關
            'cat', 'dog', 'pet', 'puppy', 'kitten', 'animal', 'animals'
        }
        
        # 從提示詞中提取關鍵字
        words = clean_prompt.lower().split()
        for w in words:
            w_clean = w.strip('.,!?;:()[]{}')
            if w_clean not in stop_words and len(w_clean) > 2 and w_clean.isalpha():
                if w_clean in core_theme_words:
                    core_keywords.append(w_clean)  # 核心關鍵字優先
                else:
                    keywords.append(w_clean)
        
        # 方法2: 從中文描述中提取並翻譯（擴展的對照表）
        if len(core_keywords) < 2:
            # 擴展的中英文對照（包含更多主題）
            translation_map = {
                # 3C相關
                '手機': 'smartphone', '智慧手機': 'smartphone', '電話': 'phone',
                '筆電': 'laptop', '筆記型電腦': 'laptop', '電腦': 'computer',
                '平板': 'tablet', '平板電腦': 'tablet',
                '耳機': 'headphones', '藍牙耳機': 'headphones', '無線耳機': 'headphones',
                '充電器': 'charger', '無線充電': 'charger', '充電': 'charging',
                '智慧手錶': 'watch', '手錶': 'watch',
                '3C': 'electronics', '3c': 'electronics', '數位': 'digital', '科技': 'technology',
                '產品': 'product', '裝置': 'device', '配件': 'accessories',
                # 寵物相關
                '貓': 'cat', '貓咪': 'cat', '橘貓': 'cat', '黃金獵犬': 'dog',
                '狗': 'dog', '狗狗': 'dog', '老狗': 'dog', '寵物': 'pet', '毛孩': 'pet',
                # 星座相關（重點擴展）
                '星星': 'star', '星座': 'constellation', '太空': 'space', '宇宙': 'universe',
                '星宿': 'constellation', '星圖': 'star chart', '占星': 'astrology',
                '占星師': 'astrologer', '占星學': 'astrology', '占星術': 'astrology',
                '星座符號': 'zodiac symbol', '符號': 'symbol', '行星': 'planet',
                '水星': 'mercury', '金星': 'venus', '火星': 'mars', '木星': 'jupiter',
                '土星': 'saturn', '太陽': 'sun', '月亮': 'moon',
                '夜空': 'night sky', '深藍色': 'deep blue', '閃爍': 'twinkling',
                '光芒': 'glow', '神秘': 'mystical', '古老': 'ancient',
                '十二星座': 'zodiac', '情侶': 'couple', '愛心': 'heart',
                '能量': 'energy', '流動': 'flow', '視覺效果': 'visual effect',
                '天文': 'astronomy', '銀河': 'galaxy', '星空': 'starry sky',
                # 通用
                '展示': 'display', '排列': 'arranged', '整齊': 'neatly'
            }
            
            for chinese, english in translation_map.items():
                if chinese in description:
                    # 如果是多詞短語，拆分
                    if ' ' in english:
                        for word in english.split():
                            if word not in core_keywords and word not in keywords:
                                if word in core_theme_words:
                                    core_keywords.append(word)
                                else:
                                    keywords.append(word)
                    else:
                        if english not in core_keywords and english not in keywords:
                            if english in core_theme_words:
                                core_keywords.append(english)
                            else:
                                keywords.append(english)
        
        # 方法3: 如果還是不足，直接使用提示詞中的主要名詞
        if len(core_keywords) < 2:
            # 提取提示詞中的主要名詞（通常是較長的單詞）
            main_words = [w.strip('.,!?;:()[]{}') for w in words if len(w.strip('.,!?;:()[]{}')) > 4 and w.strip('.,!?;:()[]{}') not in stop_words]
            for w in main_words[:3]:
                if w not in core_keywords and w not in keywords:
                    keywords.append(w)
        
        # 合併關鍵字（核心關鍵字優先）
        unique_keywords = []
        seen = set()
        
        # 先添加核心關鍵字
        for kw in core_keywords:
            if kw not in seen:
                unique_keywords.append(kw)
                seen.add(kw)
        
        # 再添加其他關鍵字
        for kw in keywords:
            if kw not in seen:
                unique_keywords.append(kw)
                seen.add(kw)
        
        return unique_keywords[:6] if unique_keywords else ['product']
    
    def generate_search_queries(self, description, prompt):
        """生成多個搜索查詢，優先使用核心關鍵字"""
        keywords = self.extract_search_keywords(description, prompt)
        queries = []
        
        if not keywords:
            return ['product']  # 預設查詢
        
        # 查詢1: 所有關鍵字（最完整）
        if len(keywords) >= 2:
            queries.append(' '.join(keywords))
        
        # 查詢2: 前3個關鍵字（核心關鍵字優先）
        if len(keywords) >= 3:
            queries.append(' '.join(keywords[:3]))
        
        # 查詢3: 前2個關鍵字（最核心）
        if len(keywords) >= 2:
            queries.append(' '.join(keywords[:2]))
        
        # 查詢4: 第一個關鍵字（最重要）
        if keywords:
            queries.append(keywords[0])
        
        # 查詢5: 如果關鍵字較多，嘗試核心關鍵字組合
        if len(keywords) >= 4:
            # 取前2個和最後1個（通常是核心+描述）
            queries.append(f"{keywords[0]} {keywords[1]} {keywords[-1]}")
        
        # 去重
        unique_queries = []
        seen = set()
        for q in queries:
            q_clean = q.strip()
            if q_clean and q_clean not in seen:
                unique_queries.append(q_clean)
                seen.add(q_clean)
        
        return unique_queries if unique_queries else [keywords[0] if keywords else 'product']
    
    def calculate_image_hash(self, image):
        """計算圖片的hash值，用於去重"""
        # 將圖片轉換為bytes並計算hash
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        image_bytes = buffer.getvalue()
        return hashlib.md5(image_bytes).hexdigest()
    
    def is_image_duplicate(self, image_url, image_data=None):
        """檢查圖片是否已使用過"""
        # 檢查URL是否已使用
        if image_url in self.used_image_urls:
            return True
        
        # 如果有圖片數據，計算hash檢查
        if image_data:
            image_hash = self.calculate_image_hash(image_data)
            if image_hash in self.used_image_hashes:
                return True
        
        return False
    
    def mark_image_as_used(self, image_url, image_data=None):
        """標記圖片為已使用"""
        self.used_image_urls.add(image_url)
        if image_data:
            image_hash = self.calculate_image_hash(image_data)
            self.used_image_hashes.add(image_hash)
    
    def download_from_pexels(self, search_query, width=1920, height=1080, description=""):
        """從Pexels下載無版權圖片，使用更精確的搜尋，並避免重複"""
        api_key = self.config.get('pexels_api_key', '')
        if not api_key:
            return None
        
        url = "https://api.pexels.com/v1/search"
        headers = {'Authorization': api_key}
        
        # 清理查詢字串
        clean_query = re.sub(r'[,\s]+', ' ', search_query).strip()
        
        params = {
            'query': clean_query,
            'per_page': 20,  # 獲取更多結果以便選擇和去重
            'orientation': 'landscape'
        }
        
        try:
            response = requests.get(url, headers=headers, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            if data.get('photos') and len(data['photos']) > 0:
                photos = data['photos']
                
                # 嘗試選擇最相關且未使用過的圖片
                keywords = clean_query.lower().split()
                best_photo = None
                best_score = -100
                
                # 判斷主題（用於負面關鍵字過濾和相關性檢查）
                is_3c_theme = any(kw in clean_query.lower() for kw in ['phone', 'smartphone', 'laptop', 'tablet', 'electronics', 'tech', '3c', 'digital', 'device', 'charger', 'headphone', 'watch', 'computer'])
                is_pet_theme = any(kw in clean_query.lower() for kw in ['cat', 'dog', 'pet', 'animal', 'puppy', 'kitten'])
                is_constellation_theme = any(kw in clean_query.lower() for kw in ['constellation', 'zodiac', 'astrology', 'star', 'stars', 'planet', 'astronomy', 'celestial', 'cosmic', 'galaxy', 'universe', 'night sky', 'starry'])
                
                # 負面關鍵字列表
                negative_terms_3c = ['makeup', 'cosmetic', 'beauty', 'skincare', 'perfume', 'lipstick', 'foundation', 'mascara', 'nail', 'hair', 'fashion', 'clothing', 'shoes', 'bag', 'jewelry', 'cosmetics']
                negative_terms_pet = ['human', 'people', 'person', 'adult', 'child', 'woman', 'man', 'girl', 'boy']
                negative_terms_constellation = ['earth', 'ground', 'terrestrial', 'landscape', 'mountain', 'forest', 'ocean', 'beach', 'city', 'building', 'street', 'indoor', 'room', 'furniture']
                
                # 核心關鍵字（必須匹配）
                core_keywords_list = [kw for kw in keywords if kw in ['constellation', 'zodiac', 'astrology', 'star', 'stars', 'planet', 'smartphone', 'phone', 'laptop', 'tablet', 'cat', 'dog', 'pet']]
                
                for photo in photos:
                    # 檢查是否已使用過（先檢查URL）
                    photo_url = photo.get('src', {}).get('large2x') or photo.get('src', {}).get('large') or photo.get('src', {}).get('medium')
                    if self.is_image_duplicate(photo_url):
                        continue  # 跳過已使用的圖片
                    
                    score = 0
                    photo_text = (photo.get('alt', '') + ' ' + photo.get('photographer', '')).lower()
                    
                    # 計算相關性分數（核心關鍵字權重更高）
                    for keyword in keywords:
                        if keyword in photo_text:
                            if keyword in core_keywords_list:
                                score += 5  # 核心關鍵字匹配大幅加分
                            else:
                                score += 2  # 一般關鍵字匹配加分
                    
                    # 負面關鍵字檢查（嚴格過濾）
                    if is_3c_theme:
                        if any(term in photo_text for term in negative_terms_3c):
                            continue  # 直接跳過不相關的圖片
                    elif is_pet_theme:
                        if any(term in photo_text for term in negative_terms_pet):
                            score -= 30  # 大幅扣分
                    elif is_constellation_theme:
                        if any(term in photo_text for term in negative_terms_constellation):
                            score -= 20  # 扣分但不完全排除（因為可能有星空+地面的照片）
                    
                    # 如果沒有匹配到任何關鍵字，跳過
                    if score <= 0:
                        continue
                    
                    # 如果查詢包含核心關鍵字，但圖片沒有匹配到核心關鍵字，降低分數
                    if core_keywords_list and not any(kw in photo_text for kw in core_keywords_list):
                        score -= 10
                    
                    if score > best_score:
                        best_score = score
                        best_photo = photo
                
                # 如果沒有找到合適的，返回None（要求至少匹配到一個關鍵字）
                if not best_photo or best_score <= 0:
                    return None
                
                # 最終檢查：確保圖片真的相關（至少匹配到一個核心關鍵字或兩個一般關鍵字）
                if core_keywords_list:
                    photo_text_final = (best_photo.get('alt', '') + ' ' + best_photo.get('photographer', '')).lower()
                    if not any(kw in photo_text_final for kw in core_keywords_list):
                        # 如果沒有匹配核心關鍵字，至少要有2個一般關鍵字匹配
                        matched_count = sum(1 for kw in keywords if kw in photo_text_final and kw not in core_keywords_list)
                        if matched_count < 2:
                            return None  # 相關性不足，返回None嘗試下一個查詢
                
                image_url = best_photo['src']['large2x'] or best_photo['src']['large'] or best_photo['src']['medium']
                
                # 再次檢查URL（防止重複）
                if self.is_image_duplicate(image_url):
                    return None
                
                img_response = requests.get(image_url, timeout=30)
                img_response.raise_for_status()
                img = Image.open(io.BytesIO(img_response.content))
                
                if img.size != (width, height):
                    img = img.resize((width, height), Image.Resampling.LANCZOS)
                
                # 標記為已使用
                self.mark_image_as_used(image_url, img)
                
                return img
            else:
                return None
        except Exception as e:
            return None
    
    def search_and_download_image(self, description, prompt):
        """根據描述從網路搜尋並下載圖片，確保不重複"""
        prompt_hash = hashlib.md5(f"{description}|{prompt}".encode('utf-8')).hexdigest()
        
        if prompt_hash in self.generated_images:
            print(f"  ⚠ 跳過重複的描述（已下載過）")
            return None
        
        print(f"  → 描述: {description}")
        
        search_queries = self.generate_search_queries(description, prompt)
        print(f"  → 搜索關鍵字: {', '.join(search_queries[:3])}")
        
        retry_count = self.config.get('search_retry_count', 5)  # 增加重試次數
        queries_to_try = search_queries[:retry_count]
        
        for query in queries_to_try:
            try:
                print(f"  → 嘗試搜索: {query}")
                image = self.download_from_pexels(query, description=description)
                if image:
                    print(f"  ✓ 成功下載圖片（查詢: {query}）")
                    self.generated_images[prompt_hash] = True
                    return image
            except Exception as e:
                print(f"  ⚠ 搜索失敗: {str(e)[:50]}")
                continue
        
        raise Exception("無法從Pexels下載符合描述的圖片，請檢查API設定或嘗試其他描述")
    
    def check_image_exists(self, filename, output_dir):
        """檢查圖片是否已存在"""
        file_path = os.path.join(output_dir, filename)
        return os.path.exists(file_path)
    
    def convert_to_webp(self, image, output_path, quality=85, max_size_kb=100):
        """將圖片轉換為WebP格式並壓縮"""
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        target_width = 1920
        target_height = 1080
        if image.size != (target_width, target_height):
            image = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
        
        current_quality = quality
        scale_factor = 1.0
        
        while True:
            temp_image = image.copy()
            if scale_factor < 1.0:
                new_width = int(temp_image.width * scale_factor)
                new_height = int(temp_image.height * scale_factor)
                temp_image = temp_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            buffer = io.BytesIO()
            temp_image.save(buffer, format='WEBP', quality=current_quality, method=6)
            file_size_kb = len(buffer.getvalue()) / 1024
            
            if file_size_kb <= max_size_kb:
                with open(output_path, 'wb') as f:
                    f.write(buffer.getvalue())
                print(f"  → 檔案大小: {file_size_kb:.1f} KB")
                return True
            
            if current_quality > 60:
                current_quality -= 5
            elif scale_factor > 0.7:
                scale_factor -= 0.05
            else:
                with open(output_path, 'wb') as f:
                    f.write(buffer.getvalue())
                print(f"  ⚠ 檔案大小: {file_size_kb:.1f} KB (超過限制但已保存)")
                return True
    
    def process_markdown_file(self, file_path, output_dir=None):
        """處理Markdown描述檔，下載所有圖片"""
        if output_dir is None:
            output_dir = self.config.get('output_dir', 'downloaded_images')
        
        os.makedirs(output_dir, exist_ok=True)
        
        print(f"\n正在解析描述檔: {file_path}")
        try:
            images = self.parse_markdown(file_path)
        except Exception as e:
            raise Exception(f"解析Markdown文件失敗: {str(e)}")
        
        if not images:
            raise Exception("未找到任何圖片描述，請檢查文件格式")
        
        print(f"找到 {len(images)} 張圖片需要下載")
        print(f"已使用圖片數量: {len(self.used_image_urls)} (避免重複)\n")
        
        success_count = 0
        skip_count = 0
        fail_count = 0
        
        max_size_kb = self.config.get('max_file_size_kb', 100)
        quality = self.config.get('webp_quality', 85)
        
        for i, img_info in enumerate(images, 1):
            filename = img_info['filename']
            description = img_info['description']
            prompt = img_info['prompt']
            output_path = os.path.join(output_dir, filename)
            
            print(f"[{i}/{len(images)}] {filename}")
            print(f"  描述: {description}")
            
            if self.config.get('skip_existing', True) and self.check_image_exists(filename, output_dir):
                print(f"  ✓ 圖片已存在，跳過\n")
                skip_count += 1
                continue
            
            try:
                image = self.search_and_download_image(description, prompt)
                if image:
                    self.convert_to_webp(image, output_path, quality=quality, max_size_kb=max_size_kb)
                    print(f"  ✓ 成功保存\n")
                    success_count += 1
                else:
                    print(f"  ✗ 下載失敗\n")
                    fail_count += 1
            except KeyboardInterrupt:
                print(f"\n\n使用者中斷操作")
                break
            except Exception as e:
                print(f"  ✗ 錯誤: {str(e)}\n")
                fail_count += 1
            
            if i < len(images):
                delay = self.config.get('delay_between_requests', 2.0)
                time.sleep(delay)
        
        print(f"\n{'='*60}")
        print(f"處理完成！")
        print(f"  成功: {success_count}")
        print(f"  跳過: {skip_count}")
        print(f"  失敗: {fail_count}")
        print(f"  總計: {len(images)}")
        print(f"\n輸出目錄: {os.path.abspath(output_dir)}")
        print(f"{'='*60}")
        
        return {
            'success': success_count,
            'skip': skip_count,
            'fail': fail_count,
            'total': len(images)
        }

def select_file():
    """使用GUI或命令列選擇Markdown文件"""
    if GUI_AVAILABLE:
        root = tk.Tk()
        root.withdraw()
        file_path = filedialog.askopenfilename(
            title="選擇圖片描述檔 (Markdown)",
            filetypes=[("Markdown文件", "*.md"), ("所有文件", "*.*")]
        )
        root.destroy()
        return file_path
    else:
        print("\n請輸入Markdown描述檔的路徑:")
        file_path = input("> ").strip().strip('"').strip("'")
        return file_path

def main():
    """主函數"""
    print("="*60)
    print("圖片下載工具 - 從網路搜尋並下載無版權圖片")
    print("="*60)
    
    # 檢查命令行參數
    file_path = None
    output_dir = None
    
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        print(f"\n使用命令行指定的文件: {file_path}")
    else:
        print("\n請選擇Markdown描述檔...")
        file_path = select_file()
    
    if len(sys.argv) > 2:
        output_dir = sys.argv[2]
        print(f"使用命令行指定的輸出目錄: {output_dir}")
    
    if not file_path:
        print("未選擇文件，程式結束")
        return
    
    if not os.path.exists(file_path):
        print(f"錯誤: 文件不存在: {file_path}")
        return
    
    generator = ImageGenerator()
    
    # 檢查API設定
    pexels_key = generator.config.get('pexels_api_key', '')
    
    if not pexels_key:
        print(f"\n⚠ 警告: Pexels API Key未設定！")
        print(f"請編輯 image_downloader_config.json 設定：")
        print(f"  - pexels_api_key: 你的Pexels API Key")
        print(f"\n取得Pexels API Key:")
        print(f"  - Pexels: https://www.pexels.com/api/")
        print(f"\n注意: 如果沒有API Key，程式仍會嘗試下載，但可能失敗")
        
        response = input("\n是否繼續？（y/n）: ").strip().lower()
        if response != 'y':
            return
    else:
        print(f"✓ Pexels API Key 已設定")
    
    if not output_dir:
        output_dir = generator.config.get('output_dir', 'downloaded_images')
        print(f"\n預設輸出目錄: {output_dir}")
        custom_dir = input("輸入自訂輸出目錄（直接按Enter使用預設）: ").strip()
        if custom_dir:
            output_dir = custom_dir
    
    try:
        result = generator.process_markdown_file(file_path, output_dir)
        
        if GUI_AVAILABLE:
            root = tk.Tk()
            root.withdraw()
            messagebox.showinfo(
                "處理完成",
                f"處理完成！\n\n"
                f"成功: {result['success']}\n"
                f"跳過: {result['skip']}\n"
                f"失敗: {result['fail']}\n"
                f"總計: {result['total']}\n\n"
                f"輸出目錄:\n{os.path.abspath(output_dir)}"
            )
            root.destroy()
    except KeyboardInterrupt:
        print("\n\n使用者中斷操作")
        sys.exit(0)
    except Exception as e:
        print(f"\n錯誤: {str(e)}")
        import traceback
        traceback.print_exc()
        if GUI_AVAILABLE:
            root = tk.Tk()
            root.withdraw()
            messagebox.showerror("錯誤", f"處理失敗:\n{str(e)}")
            root.destroy()
        sys.exit(1)

if __name__ == '__main__':
    main()
