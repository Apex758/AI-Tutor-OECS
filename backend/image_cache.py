import os
from collections import deque

class ImageCache:
    def __init__(self, cache_dir='whiteboard_images', max_size=5):
        self.cache_dir = cache_dir
        self.max_size = max_size
        self.cache = deque()
        os.makedirs(cache_dir, exist_ok=True)
        self.load_cache()

    def load_cache(self):
        files = os.listdir(self.cache_dir)
        files.sort(key=lambda x: os.path.getmtime(os.path.join(self.cache_dir, x)))
        for file in files:
            self.cache.append(file)

    def add_image(self, image_data, filename):
        if len(self.cache) >= self.max_size:
            oldest_file = self.cache.popleft()
            os.remove(os.path.join(self.cache_dir, oldest_file))
        with open(os.path.join(self.cache_dir, filename), 'wb') as f:
            f.write(image_data)
        self.cache.append(filename)

    def get_latest_image(self):
        if self.cache:
            latest_file = self.cache[-1]
            with open(os.path.join(self.cache_dir, latest_file), 'rb') as f:
                return f.read()
        return None