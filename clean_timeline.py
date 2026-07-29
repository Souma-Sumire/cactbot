import re
import sys
import argparse
def time_to_seconds(time_str):
    parts = time_str.split(":")
    if len(parts) == 2:
        return float(parts[0]) * 60 + float(parts[1])
    elif len(parts) == 3:
        return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    return float(time_str)
def get_skill_prefix(skill_name):
    name = skill_name.strip()
    if not name:
        return ""
    if re.search(r"[\u4e00-\u9fa5]", name):
        return name[:2]
    else:
        words = name.split()
        if words:
            return words[0].lower()[:8]
        return name.lower()[:8]
def parse_line(line):
    # 兼容:
    # 1. 01:23.4 / 73.2 / 271.0 等各种时间戳
    # 2. 带或不带 Ability / StartsUsing 等动作关键字
    pattern = r"^(\d+(?::\d+)*(?:\.\d+)?)\s+\"([^\"]+)\"(?:\s+(\w+))?"
    match = re.match(pattern, line.strip())
    if match:
        time_stamp = match.group(1)
        skill_name = match.group(2)
        action_type = match.group(3) or "Ability"
        return {
            "time": time_stamp,
            "skill": skill_name,
            "action": action_type,
            "raw": line.strip()
        }
    return None
def strip_trailing_comment(line):
    stripped = line.strip()
    if not stripped:
        return line
    if stripped.startswith("#"):
        return line
    if "#" in line:
        return line.split("#", 1)[0].rstrip()
    return line
def clean_timeline(input_text):
    lines = input_text.splitlines()
    result = []

    # 记录上一次保留的时间戳
    # key: (skill_prefix, action_type), value: time_in_seconds
    last_seen_registry = {}

    # 记录同一秒内已保留的前缀与全名
    # key: second_int, value: set of (skill_prefix/skill_name)
    same_second_registry = {}

    for line in lines:
        if not line.strip():
            result.append("")
            continue

        clean_line_str = strip_trailing_comment(line)

        parsed = parse_line(clean_line_str)
        if not parsed:
            result.append(clean_line_str)
            continue

        time_str = parsed["time"]
        skill_name = parsed["skill"]
        action = parsed["action"]

        # 只处理 Ability
        if action != "Ability":
            continue

        try:
            current_time = time_to_seconds(time_str)
        except ValueError:
            result.append(clean_line_str)
            continue

        current_second = round(current_time, 1) # 精确到0.1秒或整数秒
        second_key = int(current_time)
        prefix = get_skill_prefix(skill_name)

        # 1. 同秒/同一精确时间下，相同前缀或完全同名的技能只保留第一个
        if second_key not in same_second_registry:
            same_second_registry[second_key] = set()

        unique_key = (prefix, skill_name)
        if unique_key in same_second_registry[second_key]:
            continue

        # 2. 连续重复过滤：同前缀技能间隔小于 4.0 秒则过滤
        registry_key = (prefix, action)
        if registry_key in last_seen_registry:
            last_seen_time = last_seen_registry[registry_key]
            if 0 <= (current_time - last_seen_time) <= 4.0:
                continue

        result.append(clean_line_str)

        last_seen_registry[registry_key] = current_time
        same_second_registry[second_key].add(unique_key)

    return "\n".join(result)

def main():
    parser = argparse.ArgumentParser(description="整理FF14时间轴：同时间同技能动作，不管ID是否一致只保留一个。")
    parser.add_argument("input_file", nargs="?", help="输入的时间轴文件路径。如果不提供且没有管道输入，将读取 input.txt。")
    parser.add_argument("-o", "--output", help="输出文件路径。如果不提供且是文件输入，默认生成 [input_file]_cleaned.txt；如果是标准输入，则直接输出到控制台。")
    
    args = parser.parse_args()
    
    content = ""
    is_stdin = False
    
    # 判断是否有管道输入
    if not sys.stdin.isatty():
        content = sys.stdin.read()
        is_stdin = True
    elif args.input_file:
        try:
            with open(args.input_file, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            print(f"读取文件失败: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        # 默认尝试读取当前目录下的 input.txt
        default_input = "input.txt"
        try:
            with open(default_input, "r", encoding="utf-8") as f:
                content = f.read()
            args.input_file = default_input
            print(f"未指定输入文件，默认读取了 {default_input}")
        except FileNotFoundError:
            print("错误: 未指定输入文件，且未检测到标准输入，同时当前目录下不存在 input.txt。", file=sys.stderr)
            print("用法举例:\n  python clean_timeline.py input.txt\n  cat input.txt | python clean_timeline.py", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"读取默认文件 input.txt 失败: {e}", file=sys.stderr)
            sys.exit(1)
        
    cleaned_content = clean_timeline(content)
    
    if is_stdin and not args.output:
        print(cleaned_content)
    else:
        output_path = args.output
        if not output_path:
            input_name = args.input_file or "input.txt"
            if "." in input_name:
                parts = input_name.rsplit(".", 1)
                output_path = f"{parts[0]}_cleaned.{parts[1]}"
            else:
                output_path = f"{input_name}_cleaned.txt"
                
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(cleaned_content)
            print(f"整理完成！结果已保存至: {output_path}")
        except Exception as e:
            print(f"写入文件失败: {e}", file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    main()

