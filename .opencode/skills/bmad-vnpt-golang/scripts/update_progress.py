import os
import sys
import argparse
import datetime
import re
import io
import glob

# Fix for Windows console encoding issues
if sys.platform == 'win32' and hasattr(sys.stdout, 'buffer'):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    except Exception:
        pass

def get_parent_wp(master_plan_path, task_keyword):
    """
    Finds the Work Package ID (WP-XXX) that contains the given task_keyword in the Master Plan.
    """
    if not os.path.exists(master_plan_path):
        return None
        
    try:
        with open(master_plan_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        current_wp = None
        for line in lines:
            # Match Work Package Header (e.g., "### 2.1 WP-000: ...")
            wp_match = re.search(r'WP-\d+', line)
            if wp_match and "###" in line:
                current_wp = wp_match.group(0)
            
            # If we found the task on this line, return the current WP
            if task_keyword.lower() in line.lower() and "- [" in line:
                return current_wp
    except Exception as e:
        print(f"⚠️ Error parsing master plan for hierarchy: {e}")
        
    return None

def update_file_progress(file_path, keywords, status="x", cascade=False):
    """
    Updates progress for any line containing any of the keywords and a checkbox.
    If cascade is True and any keyword matches a header reference, mark ALL tasks in file.
    """
    if not os.path.exists(file_path):
        return False

    if isinstance(keywords, str):
        keywords = [keywords]

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Cascade Logic: If file is a Detail Plan and references a WP in keywords
    force_all = False
    if cascade:
        for kw in keywords:
            if "WP-" in kw.upper() and f"**Master Plan Reference**: {kw}" in content:
                print(f"   🌊 Cascading: Content of {os.path.basename(file_path)} belongs to {kw}. Marking all tasks.")
                force_all = True
                break

    lines = content.splitlines(keepends=True)
    updated = False
    new_lines = []
    
    for line in lines:
        match_found = force_all
        if not match_found:
            for kw in keywords:
                if kw.lower() in line.lower() and "- [" in line:
                    match_found = True
                    break
        
        if match_found and "- [" in line:
            # Replace [ ] with new status
            new_line = re.sub(r'\[.*?\]', f'[{status}]', line)
            
            # Add timestamp if marking as complete
            if (status == "x" or status == "X") and "Done at" not in new_line:
                timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
                new_line = new_line.strip() + f" (Done at {timestamp})\n"
            
            new_lines.append(new_line)
            updated = True
            if not force_all: # Avoid flooding console in cascade mode
                print(f"   ✅ Updated in {os.path.basename(file_path)}: {line.strip()} -> {new_line.strip()}")
        else:
            new_lines.append(line)

    if updated:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
    return updated

def main():
    parser = argparse.ArgumentParser(description="Synchronize task progress across Master Plan and Detail Plans")
    parser.add_argument("keywords", nargs='+', help="Keywords or Task IDs (e.g., TASK-001 WP-001)")
    parser.add_argument("--status", default="x", help="Status to set (e.g., x, /, or ' ')")
    parser.add_argument("--master", default="project-documentation/MASTER_PLAN.md", help="Path to Master Plan")
    parser.add_argument("--detail-dir", default="project-documentation/plans", help="Directory containing Detail Plans")
    parser.add_argument("--cascade", action="store_true", help="If keyword is a Master Task or WP, update ALL related sub-tasks in Detail Plans")
    
    args = parser.parse_args()
    
    keywords_to_update = list(args.keywords)
    
    # Hierarchy Resolution: Find parent WP for each keyword
    for kw in args.keywords:
        parent_wp = get_parent_wp(args.master, kw)
        if parent_wp and parent_wp not in keywords_to_update:
            print(f"ℹ️  Detected Parent Work Package: {parent_wp} (for {kw})")
            if args.cascade:
                keywords_to_update.append(parent_wp)

    print(f"🔄 Syncing progress for {keywords_to_update} to status '{args.status}' (Cascade: {args.cascade})...")
    
    # 1. Update Master Plan
    master_updated = update_file_progress(args.master, keywords_to_update, args.status, cascade=False)
    
    # 2. Update Detail Plans
    detail_updated = False
    if os.path.exists(args.detail_dir):
        detail_plans = glob.glob(os.path.join(args.detail_dir, "DETAIL_PLAN_*.md"))
        for plan_path in detail_plans:
            if update_file_progress(plan_path, keywords_to_update, args.status, cascade=args.cascade):
                detail_updated = True
                
    if not master_updated and not detail_updated:
        print(f"❌ Error: No task matching keywords found in any plan files.")
        sys.exit(1)
    
    print("✨ Progress synchronization complete.")

if __name__ == "__main__":
    main()
