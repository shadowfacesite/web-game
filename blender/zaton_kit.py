# -*- coding: utf-8 -*-
"""
zaton_kit.py — дополнение Blender для работы над картой «Затона».

Как поставить:
    Edit → Preferences → Add-ons → Install… → выбрать этот файл → включить.
    Либо: открыть в Blender вкладку Scripting, вставить файл, нажать Run.

Где появится:
    3D-вид → клавиша N → вкладка «Затон» справа.

Что делает:
    · настраивает сцену под проект — метры, сетка 0.5 м, дальность отсечения;
    · заводит коллекции с теми именами, которые ждёт игра;
    · подгружает блокаут из export/house.obj как подложку и запирает её;
    · ставит начало координат по правилам кита одним нажатием;
    · проверяет карту до экспорта и говорит словами, что не так;
    · выгружает .glb прямо в public/models — туда, откуда его читает сайт.

──────────────────────────────────────────────────────────────────────────
ОСИ. Это единственное место, где легко ошибиться, и ошибку видно только
на скриншоте, когда дом уже зеркальный.

Blender внутри Z вверх. glTF и кит — Y вверх. Экспортёр с галкой «+Y Up»
переводит так:

    Blender X  →  X кита          длина предмета
    Blender Z  →  Y кита          высота, вверх
    Blender Y  →  −Z кита         глубина

Отсюда правила, которые проверяет «Проверить карту»:

    напольный предмет   низ лежит на Z = 0, начало координат в центре пятна
    настенный предмет   плоскость стены — Y = 0, предмет растёт в +Y
    длина               всегда вдоль X

Галку «+Y Up» при экспорте не снимать. Настройки импорта .obj не трогать:
у них значения по умолчанию как раз те, что нужны.
──────────────────────────────────────────────────────────────────────────
"""

bl_info = {
    "name": "Затон — кит",
    "description": "Настройка сцены, подложка блокаута, проверка и выгрузка карты",
    "author": "проект Затон",
    "version": (1, 0, 0),
    "blender": (3, 6, 0),
    "location": "3D-вид → N → Затон",
    "category": "Scene",
}

import os
import bpy
from bpy.props import BoolProperty, EnumProperty, PointerProperty, StringProperty
from bpy.types import Operator, Panel, PropertyGroup


# ─────────────────────────────────────────────────────────────────────────
# Соглашения проекта
# ─────────────────────────────────────────────────────────────────────────

# Коллекции. Имена не косметика: по ним экспорт понимает, что вывозить,
# а что оставить в Blender.
COL_MAP = "карта"          # то, что попадёт в игру
COL_REF = "подложка"       # блокаут из export/*.obj, в игру не идёт
COL_COL = "коллизии"       # простые коробки, по которым игрок упирается
COL_TRASH = "черновик"     # всё, что пока непонятно куда

LEVELS = ["cellar", "f1", "f2", "f3"]
LEVEL_RU = {"cellar": "подвал", "f1": "1-й этаж", "f2": "2-й этаж", "f3": "3-й этаж"}

# Дом 24 × 16 м, четыре уровня по 3 м. Проверка сверяется с этими числами.
HOUSE_W = 24.0
HOUSE_D = 16.0
HOUSE_H = 12.0

CELL = 0.5           # клетка планировки
BAD_NAMES = {"Cube", "Plane", "Sphere", "Cylinder", "Куб", "Плоскость", "Circle", "Icosphere"}


# ─────────────────────────────────────────────────────────────────────────
# Мелкие помощники
# ─────────────────────────────────────────────────────────────────────────

def ensure_collection(name, parent=None):
    """Коллекция с таким именем, привязанная к родителю. Повторный вызов безвреден."""
    parent = parent or bpy.context.scene.collection
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
    if col.name not in [c.name for c in parent.children]:
        try:
            parent.children.link(col)
        except RuntimeError:
            pass  # уже привязана где-то ещё — это нормально
    return col


def activate_collection(name):
    """Сделать коллекцию активной, чтобы импорт лёг именно в неё."""
    layer = bpy.context.view_layer.layer_collection.children.get(name)
    if layer is not None:
        bpy.context.view_layer.active_layer_collection = layer
        return True
    return False


def call_op(op, desired):
    """
    Вызвать оператор, отбросив параметры, которых нет в этой версии Blender.

    Между версиями параметры экспортёра переименовывают, и вызов со старым
    именем валится целиком. Отбор по фактическому списку свойств — способ
    не разбирать, какая версия у тебя стоит.
    """
    try:
        known = set(op.get_rna_type().properties.keys())
        kwargs = {k: v for k, v in desired.items() if k in known}
    except Exception:
        kwargs = dict(desired)
    return op(**kwargs)


def mesh_objects(collection):
    """Все меши коллекции и её потомков."""
    out = []
    if collection is None:
        return out
    for obj in collection.all_objects:
        if obj.type == "MESH":
            out.append(obj)
    return out


def world_bounds(objects):
    """Габарит набора объектов в мировых координатах."""
    lo = [float("inf")] * 3
    hi = [float("-inf")] * 3
    for obj in objects:
        for corner in obj.bound_box:
            p = obj.matrix_world @ __import__("mathutils").Vector(corner)
            for i in range(3):
                lo[i] = min(lo[i], p[i])
                hi[i] = max(hi[i], p[i])
    if lo[0] == float("inf"):
        return (0, 0, 0), (0, 0, 0)
    return tuple(lo), tuple(hi)


def tri_count(obj):
    return sum(max(0, len(p.vertices) - 2) for p in obj.data.polygons)


def ngon_count(obj):
    return sum(1 for p in obj.data.polygons if len(p.vertices) > 4)


# ─────────────────────────────────────────────────────────────────────────
# Настройки, живущие в сцене
# ─────────────────────────────────────────────────────────────────────────

class ZatonProps(PropertyGroup):
    root: StringProperty(
        name="Папка проекта",
        description="Корень репозитория: та, где лежат package.json и spec/",
        subtype="DIR_PATH",
        default="",
    )
    origin_mode: EnumProperty(
        name="Начало координат",
        description="Куда поставить начало координат выделенных объектов",
        items=[
            ("FLOOR", "На пол", "Низ на Z = 0, начало в центре пятна. Для мебели и реквизита"),
            ("WALL", "На стену", "Плоскость стены Y = 0, предмет растёт в +Y. Для полок и картин"),
            ("CENTER", "В центр", "Центр габарита. Для того, что висит и вращается"),
        ],
        default="FLOOR",
    )
    apply_scale: BoolProperty(
        name="Применить масштаб",
        description="Ctrl+A → Scale. Без этого модель приезжает в игру не того размера",
        default=True,
    )
    report_text: StringProperty(default="")


# ─────────────────────────────────────────────────────────────────────────
# 1. Настроить сцену
# ─────────────────────────────────────────────────────────────────────────

class ZATON_OT_setup(Operator):
    bl_idname = "zaton.setup"
    bl_label = "Настроить сцену"
    bl_description = "Метры, сетка 0.5 м, отсечение, коллекции проекта"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        scene = context.scene

        # Единицы. Если тут метры не выставлены, размеры в панели врут,
        # и «шкаф два метра» оказывается двумя условными единицами.
        scene.unit_settings.system = "METRIC"
        scene.unit_settings.scale_length = 1.0
        try:
            scene.unit_settings.length_unit = "METERS"
        except TypeError:
            pass

        # Сетка с шагом клетки планировки. По ней видно, попадает ли стена
        # в клетку, — а это единственное, что делает дом собираемым.
        for area in context.screen.areas:
            if area.type != "VIEW_3D":
                continue
            for space in area.spaces:
                if space.type != "VIEW_3D":
                    continue
                space.overlay.grid_scale = CELL
                space.overlay.grid_subdivisions = 5
                space.overlay.show_floor = True
                space.overlay.show_axis_x = True
                space.overlay.show_axis_y = True
                # Ближняя плоскость 5 см: иначе, встав внутрь комнаты,
                # видишь стены изнутри насквозь.
                space.clip_start = 0.05
                space.clip_end = 1000.0

        ensure_collection(COL_REF)
        col_map = ensure_collection(COL_MAP)
        for lvl in LEVELS:
            ensure_collection("уровень_" + lvl, col_map)
        ensure_collection(COL_COL)
        ensure_collection(COL_TRASH)
        activate_collection(COL_MAP)

        self.report({"INFO"}, "Сцена настроена: метры, сетка %.2f м, коллекции заведены" % CELL)
        return {"FINISHED"}


# ─────────────────────────────────────────────────────────────────────────
# 2. Подложка
# ─────────────────────────────────────────────────────────────────────────

class ZATON_OT_underlay(Operator):
    bl_idname = "zaton.underlay"
    bl_label = "Подгрузить блокаут"
    bl_description = "Импортировать export/house.obj как подложку и запереть её"
    bl_options = {"REGISTER", "UNDO"}

    which: EnumProperty(
        items=[("house", "Дом", ""), ("kit", "Кит", "")],
        default="house",
    )

    def execute(self, context):
        props = context.scene.zaton
        root = bpy.path.abspath(props.root).strip()
        if not root:
            self.report({"ERROR"}, "Сначала укажи папку проекта")
            return {"CANCELLED"}

        path = os.path.join(root, "export", self.which + ".obj")
        if not os.path.exists(path):
            self.report({"ERROR"}, "Нет файла %s — выполни в проекте: npm run blender" % path)
            return {"CANCELLED"}

        ensure_collection(COL_REF)
        activate_collection(COL_REF)
        before = set(bpy.data.objects.keys())

        # Настройки осей — по умолчанию: файл записан Y вверх, и Blender
        # сам переводит его в свой Z вверх. Менять их нельзя.
        try:
            call_op(bpy.ops.wm.obj_import, {
                "filepath": path,
                "forward_axis": "NEGATIVE_Z",
                "up_axis": "Y",
                "use_split_objects": True,
            })
        except AttributeError:
            call_op(bpy.ops.import_scene.obj, {
                "filepath": path,
                "axis_forward": "-Z",
                "axis_up": "Y",
                "use_split_objects": True,
            })

        added = [bpy.data.objects[k] for k in bpy.data.objects.keys() if k not in before]
        for obj in added:
            # Подложка нужна как линейка, а не как модель: её нельзя выделить
            # мышью, она рисуется каркасом и не попадает в рендер.
            obj.display_type = "WIRE"
            obj.hide_select = True
            obj.hide_render = True
            obj.name = "подложка_" + obj.name

        activate_collection(COL_MAP)
        self.report({"INFO"}, "Подложка загружена: объектов %d. Выделить её мышью нельзя — так и задумано" % len(added))
        return {"FINISHED"}


# ─────────────────────────────────────────────────────────────────────────
# 3. Начало координат по правилам кита
# ─────────────────────────────────────────────────────────────────────────

class ZATON_OT_origin(Operator):
    bl_idname = "zaton.origin"
    bl_label = "Поставить начало координат"
    bl_description = "По правилам кита: напольный — низом на пол, настенный — на плоскость стены"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        props = context.scene.zaton
        chosen = [o for o in context.selected_objects if o.type == "MESH"]
        if not chosen:
            self.report({"ERROR"}, "Ничего не выделено")
            return {"CANCELLED"}

        done = 0
        for obj in chosen:
            context.view_layer.objects.active = obj

            if props.apply_scale:
                # Неприменённый масштаб — причина номер один, по которой
                # модель приезжает в игру размером с ноготь.
                bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

            bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
            # После этого геометрия симметрична относительно начала координат.
            # Дальше сдвигаем её так, как договорились в ките.
            dx, dy, dz = obj.dimensions

            if props.origin_mode == "FLOOR":
                shift = (0.0, 0.0, dz / 2.0)
            elif props.origin_mode == "WALL":
                # Плоскость стены — Y = 0, предмет растёт в +Y, низ на Z = 0.
                shift = (0.0, dy / 2.0, dz / 2.0)
            else:
                shift = (0.0, 0.0, 0.0)

            if any(shift):
                mesh = obj.data
                for vert in mesh.vertices:
                    vert.co.x += shift[0]
                    vert.co.y += shift[1]
                    vert.co.z += shift[2]
                mesh.update()
                # Геометрия уехала — двигаем объект назад, чтобы на экране
                # ничего не сдвинулось.
                obj.location.x -= shift[0]
                obj.location.y -= shift[1]
                obj.location.z -= shift[2]
            done += 1

        self.report({"INFO"}, "Обработано объектов: %d" % done)
        return {"FINISHED"}


class ZATON_OT_snap(Operator):
    bl_idname = "zaton.snap"
    bl_label = "Посадить на клетку"
    bl_description = "Округлить положение выделенного до клетки 0.5 м"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        chosen = [o for o in context.selected_objects]
        if not chosen:
            self.report({"ERROR"}, "Ничего не выделено")
            return {"CANCELLED"}
        for obj in chosen:
            obj.location.x = round(obj.location.x / CELL) * CELL
            obj.location.y = round(obj.location.y / CELL) * CELL
            obj.location.z = round(obj.location.z / CELL) * CELL
        self.report({"INFO"}, "Посажено на клетку %.2f м: %d" % (CELL, len(chosen)))
        return {"FINISHED"}


# ─────────────────────────────────────────────────────────────────────────
# 4. Проверка перед выгрузкой
# ─────────────────────────────────────────────────────────────────────────

class ZATON_OT_check(Operator):
    bl_idname = "zaton.check"
    bl_label = "Проверить карту"
    bl_description = "Найти то, из-за чего модель приедет в игру не такой"
    bl_options = {"REGISTER"}

    def execute(self, context):
        props = context.scene.zaton
        col = bpy.data.collections.get(COL_MAP)
        if col is None:
            self.report({"ERROR"}, "Нет коллекции «%s» — нажми «Настроить сцену»" % COL_MAP)
            return {"CANCELLED"}

        objs = mesh_objects(col)
        problems = []
        notes = []

        if not objs:
            problems.append("В коллекции «%s» нет ни одного меша — экспортировать нечего." % COL_MAP)

        total_tris = 0
        total_ngons = 0

        for obj in objs:
            name = obj.name

            # Масштаб. Дальше по списку всё считается неверно, если он не единичный.
            s = obj.scale
            if abs(s.x - 1) > 1e-3 or abs(s.y - 1) > 1e-3 or abs(s.z - 1) > 1e-3:
                problems.append(
                    "«%s»: масштаб %.3f × %.3f × %.3f. Ctrl+A → Scale, иначе размер в игре будет другим."
                    % (name, s.x, s.y, s.z))

            d = obj.dimensions
            big = max(d)
            if big < 0.002:
                problems.append("«%s»: размер %.4f м — почти наверняка забыт масштаб." % (name, big))
            elif big > 60:
                problems.append("«%s»: размер %.1f м — больше самого дома, проверь единицы." % (name, big))

            # Начало координат далеко от геометрии — предмет не встанет туда,
            # куда его кладут, и повернуть его нельзя.
            lo, hi = world_bounds([obj])
            cx = (lo[0] + hi[0]) / 2 - obj.location.x
            cy = (lo[1] + hi[1]) / 2 - obj.location.y
            off = (cx * cx + cy * cy) ** 0.5
            if off > max(2.0, big):
                problems.append(
                    "«%s»: начало координат в %.1f м от геометрии. Object → Set Origin → Origin to Geometry."
                    % (name, off))

            tris = tri_count(obj)
            total_tris += tris
            if tris > 60000:
                notes.append("«%s»: %d треугольников — тяжело для веба." % (name, tris))

            n = ngon_count(obj)
            total_ngons += n

            if name in BAD_NAMES or name.split(".")[0] in BAD_NAMES:
                notes.append("«%s»: имя по умолчанию. В игре по именам ничего не найти." % name)

            if not obj.data.materials or all(m is None for m in obj.data.materials):
                notes.append("«%s»: нет материала — в игре будет серым." % name)

        # Что лежит вне коллекций и потому не попадёт в выгрузку.
        loose = [o.name for o in context.scene.collection.objects if o.type == "MESH"]
        if loose:
            problems.append(
                "Вне коллекций лежит мешей: %d (%s…). Экспорт их не возьмёт."
                % (len(loose), ", ".join(loose[:3])))

        # Габарит всей карты. Это самая надёжная проверка осей: если вверх
        # уходит больше, чем в плане, значит сцена лежит на боку.
        if objs:
            lo, hi = world_bounds(objs)
            w, dd, h = hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]
            notes.append("Габарит карты: %.1f × %.1f × %.1f м (X × Y × Z, Z вверх)." % (w, dd, h))
            if h > max(w, dd):
                problems.append(
                    "Карта выше, чем шире (%.1f м вверх). Похоже, сцена повёрнута: вверх должна идти Z."
                    % h)
            if w > HOUSE_W * 1.6 or dd > HOUSE_D * 1.6:
                notes.append(
                    "Карта заметно больше дома из планировки (%.0f × %.0f м). Так и задумано?"
                    % (HOUSE_W, HOUSE_D))

        if total_ngons:
            notes.append("Граней больше четырёх углов: %d. glTF их порежет сам, но топология обычно врёт." % total_ngons)
        notes.append("Всего треугольников: %d." % total_tris)
        if total_tris > 400000:
            problems.append("%d треугольников на карту — для браузера много, стоит проредить." % total_tris)

        col_col = bpy.data.collections.get(COL_COL)
        n_col = len(mesh_objects(col_col))
        if n_col:
            notes.append("Коллизий: %d коробок." % n_col)
        else:
            notes.append(
                "Коллизий нет. Пока стены живут в spec/house-map.json, это нормально: "
                "игрок упирается в них, а не в модель.")

        lines = []
        if problems:
            lines.append("НАДО ПОЧИНИТЬ (%d):" % len(problems))
            lines += ["  ! " + p for p in problems]
            lines.append("")
        lines.append("Сводка:")
        lines += ["  · " + n for n in notes]

        props.report_text = "\n".join(lines)
        if problems:
            self.report({"WARNING"}, "Найдено проблем: %d — смотри панель" % len(problems))
        else:
            self.report({"INFO"}, "Карта в порядке: %d мешей, %d треугольников" % (len(objs), total_tris))
        return {"FINISHED"}


# ─────────────────────────────────────────────────────────────────────────
# 5. Выгрузка
# ─────────────────────────────────────────────────────────────────────────

class ZATON_OT_export(Operator):
    bl_idname = "zaton.export"
    bl_label = "Выгрузить .glb"
    bl_description = "Записать коллекцию «карта» в public/models/house.glb"
    bl_options = {"REGISTER"}

    filename: StringProperty(default="house.glb")

    def execute(self, context):
        props = context.scene.zaton
        root = bpy.path.abspath(props.root).strip()
        if not root:
            self.report({"ERROR"}, "Сначала укажи папку проекта")
            return {"CANCELLED"}

        col = bpy.data.collections.get(COL_MAP)
        if col is None or not mesh_objects(col):
            self.report({"ERROR"}, "В коллекции «%s» нечего выгружать" % COL_MAP)
            return {"CANCELLED"}

        out_dir = os.path.join(root, "public", "models")
        os.makedirs(out_dir, exist_ok=True)
        out = os.path.join(out_dir, self.filename)

        if not activate_collection(COL_MAP):
            self.report({"ERROR"}, "Не нашёл коллекцию «%s» в этом слое вида" % COL_MAP)
            return {"CANCELLED"}

        # export_yup=True — та самая галка «+Y Up». Снятая, она кладёт дом
        # на бок, и заметно это только в игре.
        call_op(bpy.ops.export_scene.gltf, {
            "filepath": out,
            "export_format": "GLB",
            "export_yup": True,
            "export_apply": True,          # модификаторы применить
            "use_selection": False,
            "use_active_collection": True,
            "use_active_collection_with_nested": True,
            "use_visible": False,
            "export_materials": "EXPORT",
            "export_texcoords": True,
            "export_normals": True,
            "export_tangents": False,
            "export_cameras": False,
            "export_lights": False,
            "export_animations": False,
            "export_extras": True,
            "export_skins": False,
        })

        size_kb = os.path.getsize(out) / 1024.0 if os.path.exists(out) else 0
        self.report({"INFO"}, "Записано: %s (%.0f КБ). Перетащи файл на окно редактора." % (out, size_kb))
        return {"FINISHED"}


# ─────────────────────────────────────────────────────────────────────────
# Панель
# ─────────────────────────────────────────────────────────────────────────

class ZATON_PT_panel(Panel):
    bl_label = "Затон"
    bl_idname = "ZATON_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Затон"

    def draw(self, context):
        layout = self.layout
        props = context.scene.zaton

        box = layout.box()
        box.label(text="Проект", icon="FILE_FOLDER")
        box.prop(props, "root", text="")

        col = layout.column(align=True)
        col.operator("zaton.setup", icon="SCENE_DATA")

        row = col.row(align=True)
        row.operator("zaton.underlay", text="Подложка: дом", icon="MOD_WIREFRAME").which = "house"
        row.operator("zaton.underlay", text="кит").which = "kit"

        layout.separator()
        box = layout.box()
        box.label(text="Правила кита", icon="ORIENTATION_LOCAL")
        box.prop(props, "origin_mode", text="")
        box.prop(props, "apply_scale")
        box.operator("zaton.origin", icon="OBJECT_ORIGIN")
        box.operator("zaton.snap", icon="SNAP_GRID")

        layout.separator()
        col = layout.column(align=True)
        col.operator("zaton.check", icon="CHECKMARK")
        col.operator("zaton.export", icon="EXPORT")

        if props.report_text:
            box = layout.box()
            for line in props.report_text.split("\n"):
                if not line:
                    continue
                icon = "ERROR" if line.strip().startswith("!") else "NONE"
                box.label(text=line, icon=icon)


# ─────────────────────────────────────────────────────────────────────────
# Регистрация
# ─────────────────────────────────────────────────────────────────────────

CLASSES = (
    ZatonProps,
    ZATON_OT_setup,
    ZATON_OT_underlay,
    ZATON_OT_origin,
    ZATON_OT_snap,
    ZATON_OT_check,
    ZATON_OT_export,
    ZATON_PT_panel,
)


def register():
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.Scene.zaton = PointerProperty(type=ZatonProps)


def unregister():
    del bpy.types.Scene.zaton
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
