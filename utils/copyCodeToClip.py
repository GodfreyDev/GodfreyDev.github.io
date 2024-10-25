import os

def collect_code(directory, output_file):
    # Ensure the output directory exists
    output_dir = os.path.dirname(output_file)
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Extensions of files you want to include (HTML, CSS, JavaScript, etc.)
    extensions = ['.html', '.css', '.js', '.json']

    # Specific files and directories to exclude
    exclude_files = ['bot.log', 'account_data.json', '.env']
    exclude_dirs = ['node_modules', 'Images', '.git']

    # Image file extensions to exclude
    image_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']

    with open(output_file, 'w', encoding='utf-8') as outfile:
        outfile.write(f"Collected code from {directory}:\n\n")

        # Walk through all files and directories
        for root, dirs, files in os.walk(directory):
            # Modify dirs in-place to skip excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs]

            for file in files:
                # Skip excluded files and image files
                if file in exclude_files or any(file.endswith(ext) for ext in image_extensions):
                    continue

                # Check if the file has one of the included extensions
                if any(file.endswith(ext) for ext in extensions):
                    filepath = os.path.join(root, file)
                    outfile.write(f"\n\n### File: {filepath}\n\n")
                    try:
                        # Read and append the file contents to the output file
                        with open(filepath, 'r', encoding='utf-8') as infile:
                            outfile.write(infile.read())
                    except Exception as e:
                        # Catch any read errors (e.g., permission issues or binary files)
                        outfile.write(f"\n[Error reading {file}: {str(e)}]\n")

    print(f"Code collected in {output_file}")

if __name__ == "__main__":
    # Root directory for code collection
    root_dir = "D:\\Website\\GodfreyDev.github.io"
    
    # Output file
    output_file = "D:\\Website\\GodfreyDev.github.io\\utils\\collected_code.txt"
    
    # Call the function to collect code
    collect_code(root_dir, output_file)
