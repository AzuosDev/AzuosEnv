"""One-off pass that gives every controller route that returns a Mongoose document
(alone, in an array or inside a cursor page) the response type in the Swagger
contract, so docs/openapi.json describes the body the front receives."""

import glob
import os
import re

DEC = re.compile(r"^(\s*)@(ApiOkResponse|ApiCreatedResponse)\(\{ description: (.+) \}\)$")
SIG = re.compile(r"^\s*\)?:\s*(.+?)\s*\{$")
SIG_ONE = re.compile(r"^\s*(?:async\s+)?[\w]+\(.*\):\s*(.+?)\s*\{$")

DOC = re.compile(r"^Promise<(\w+)Document>$")
DOC_ARRAY = re.compile(r"^Promise<(\w+)Document\[\]>$")
PAGE = re.compile(r"^Promise<CursorPage<(\w+)Document>>$")

changed_files = 0
changed_routes = 0

for path in sorted(glob.glob("src/**/*.controller.ts", recursive=True)):
    lines = open(path, encoding="utf-8").read().split("\n")
    models = set()
    paged = False
    out = list(lines)
    touched = False

    for index, line in enumerate(lines):
        match = DEC.match(line)
        if not match:
            continue

        indent, decorator, description = match.groups()
        ret = None
        for ahead in range(index + 1, min(index + 45, len(lines))):
            one = SIG_ONE.match(lines[ahead])
            if one:
                ret = one.group(1)
                break
            end = SIG.match(lines[ahead])
            if end:
                ret = end.group(1)
                break
        if not ret:
            continue

        page = PAGE.match(ret)
        array = DOC_ARRAY.match(ret)
        single = DOC.match(ret)

        if page:
            model = page.group(1)
            out[index] = f"{indent}@ApiPagedResponse({model}, {description})"
            paged = True
        elif array:
            model = array.group(1)
            out[index] = f"{indent}@{decorator}({{ description: {description}, type: [{model}] }})"
        elif single:
            model = single.group(1)
            out[index] = f"{indent}@{decorator}({{ description: {description}, type: {model} }})"
        else:
            continue

        models.add(model)
        touched = True
        changed_routes += 1

    if not touched:
        continue

    text = "\n".join(out)

    # The class of the schema joins the import that already brings its Document type.
    for model in sorted(models):
        if re.search(r"\b" + model + r"\b(?!Document)", re.sub(r"@Api\w+\([^\n]*\)", "", text)):
            pass
        imp = re.search(
            r"import \{([^}]*\b" + model + r"Document\b[^}]*)\} from ('[^']+schemas?/[^']+');",
            text,
        )
        if not imp:
            print(f"  ! sem import de {model} em {path}")
            continue
        names = [n.strip() for n in imp.group(1).split(",") if n.strip()]
        if model in names:
            continue
        names.append(model)
        names.sort()
        text = text.replace(
            imp.group(0), "import { " + ", ".join(names) + " } from " + imp.group(2) + ";", 1
        )

    if paged and "ApiPagedResponse" not in text.split("\n@")[0].split("@ApiTags")[0]:
        depth = len(os.path.relpath(path, "src").replace("\\", "/").split("/")) - 1
        prefix = "../" * depth
        decorator_import = (
            "import { ApiPagedResponse } from '"
            + prefix
            + "common/swagger/api-paged-response.decorator';"
        )
        if decorator_import not in text:
            anchor = re.search(r"^import .*from '@nestjs/swagger';$", text, re.M)
            text = text[: anchor.end()] + "\n" + decorator_import + text[anchor.end() :]

    open(path, "w", encoding="utf-8", newline="\n").write(text)
    changed_files += 1

print(f"{changed_routes} rotas anotadas em {changed_files} arquivos")
