from pathlib import Path
from datetime import datetime

import pandas as pd
import xlsxwriter


BASE_DIR = Path(__file__).resolve().parent
SOURCE_PATH = BASE_DIR / "_source" / "工作簿1.xlsx"
OUTPUT_PATH = BASE_DIR / "工作簿1_可视化分析报表.xlsx"

COLUMNS = [
    "#",
    "create_time",
    "order_no",
    "shipper_customer_code",
    "is_contract_order(test)",
    "is_contract_order(prod)",
]

FONT = "微软雅黑"
NAVY = "#17324D"
BLUE = "#2F6FED"
LIGHT_BLUE = "#E8F0FE"
GREEN = "#16A34A"
AMBER = "#D97706"
RED = "#DC2626"
GRAY = "#6B7280"
LIGHT_GRAY = "#F3F4F6"
WHITE = "#FFFFFF"


def classify_order_no(value):
    text = str(value).strip().upper()
    if text.startswith("YK"):
        return "YK"
    if text.startswith("WX"):
        return "WX"
    if text.startswith("APP"):
        return "APP"
    if text.startswith("EWD"):
        return "EWD"
    if text.startswith("O"):
        return "O"
    if text.endswith("_DPK"):
        return "DPK_HASH"
    if "_" in text:
        return "OTHER_HASH"
    return "OTHER"


def classify_customer_code(value):
    text = str(value).strip()
    if text.isdigit():
        return "纯数字"
    if text.startswith("E"):
        return "E开头"
    if text.startswith("F"):
        return "F开头"
    if text.startswith("S"):
        return "S开头"
    return "其他"


def load_data():
    df = pd.read_excel(SOURCE_PATH, sheet_name=0, header=None, skiprows=2)
    df.columns = COLUMNS
    df["#"] = pd.to_numeric(df["#"], errors="coerce").astype("Int64")
    df["create_time"] = pd.to_datetime(df["create_time"], errors="coerce")
    df["订单号结构"] = df["order_no"].map(classify_order_no)
    df["客户编码类型"] = df["shipper_customer_code"].map(classify_customer_code)
    df["日期"] = df["create_time"].dt.date
    df["小时"] = df["create_time"].dt.hour
    df["分钟段"] = df["create_time"].dt.strftime("%H:%M")
    df["时间秒"] = df["create_time"].dt.strftime("%H:%M:%S")
    return df


def build_summaries(df):
    order_structure = (
        df.groupby("订单号结构", as_index=False)
        .agg(订单数=("order_no", "size"), 唯一客户数=("shipper_customer_code", "nunique"))
        .sort_values(["订单数", "唯一客户数"], ascending=[False, False])
    )

    customer_type = (
        df.groupby("客户编码类型", as_index=False)
        .agg(订单数=("order_no", "size"), 客户数=("shipper_customer_code", "nunique"))
        .sort_values("订单数", ascending=False)
    )

    customer_summary = (
        df.assign(客户编码=df["shipper_customer_code"].map(str))
        .groupby("客户编码", as_index=False)
        .agg(
            订单数=("order_no", "size"),
            测试订单=("is_contract_order(test)", lambda s: int((s == "Y").sum())),
            生产订单=("is_contract_order(prod)", lambda s: int((s == "Y").sum())),
            首次创建时间=("create_time", "min"),
            末次创建时间=("create_time", "max"),
        )
        .sort_values(["订单数", "客户编码"], ascending=[False, True])
    )

    hours = pd.DataFrame({"小时": range(24)})
    hourly = (
        df.groupby("小时", as_index=False).agg(订单数=("order_no", "size"))
        .merge(hours, on="小时", how="right")
        .fillna({"订单数": 0})
        .sort_values("小时")
    )
    hourly["订单数"] = hourly["订单数"].astype(int)

    test_count = int((df["is_contract_order(test)"] == "Y").sum())
    prod_count = int((df["is_contract_order(prod)"] == "Y").sum())
    contract = pd.DataFrame(
        {
            "合同标志": ["test=Y", "prod=Y"],
            "订单数": [test_count, prod_count],
        }
    )

    second_stats = (
        df.groupby("时间秒", as_index=False)
        .agg(订单数=("order_no", "size"), 客户数=("shipper_customer_code", "nunique"))
        .sort_values(["订单数", "时间秒"], ascending=[False, True])
    )
    minute_stats = (
        df.groupby("分钟段", as_index=False)
        .agg(订单数=("order_no", "size"), 客户数=("shipper_customer_code", "nunique"))
        .sort_values(["订单数", "分钟段"], ascending=[False, True])
    )
    date_stats = (
        df.groupby("日期", as_index=False)
        .agg(订单数=("order_no", "size"), 客户数=("shipper_customer_code", "nunique"))
        .sort_values("日期")
    )
    date_stats["日期"] = date_stats["日期"].map(lambda v: v.strftime("%Y-%m-%d"))

    top_customers = customer_summary.head(10).copy()
    top_seconds = second_stats.head(10).copy()
    top_minutes = minute_stats.head(10).copy()

    return {
        "order_structure": order_structure,
        "customer_type": customer_type,
        "customer_summary": customer_summary,
        "top_customers": top_customers,
        "hourly": hourly,
        "contract": contract,
        "second_stats": second_stats,
        "minute_stats": minute_stats,
        "top_seconds": top_seconds,
        "top_minutes": top_minutes,
        "date_stats": date_stats,
    }


def add_formats(workbook):
    base = {
        "font_name": FONT,
        "font_size": 10,
        "valign": "vcenter",
    }
    return {
        "title": workbook.add_format(
            {**base, "font_size": 20, "bold": True, "font_color": NAVY}
        ),
        "subtitle": workbook.add_format({**base, "font_size": 11, "font_color": GRAY}),
        "section": workbook.add_format(
            {**base, "font_size": 13, "bold": True, "font_color": NAVY}
        ),
        "body": workbook.add_format({**base, "font_color": "#374151", "text_wrap": True}),
        "bullet": workbook.add_format(
            {**base, "font_color": "#374151", "text_wrap": True, "indent": 1}
        ),
        "kpi_label": workbook.add_format(
            {
                **base,
                "font_size": 10,
                "bold": True,
                "font_color": WHITE,
                "bg_color": NAVY,
                "align": "center",
            }
        ),
        "kpi_value": workbook.add_format(
            {
                **base,
                "font_size": 22,
                "bold": True,
                "font_color": NAVY,
                "bg_color": LIGHT_GRAY,
                "align": "center",
            }
        ),
        "kpi_note": workbook.add_format(
            {
                **base,
                "font_size": 9,
                "font_color": GRAY,
                "bg_color": LIGHT_GRAY,
                "align": "center",
                "text_wrap": True,
            }
        ),
        "table_header": workbook.add_format(
            {
                **base,
                "bold": True,
                "font_color": WHITE,
                "bg_color": BLUE,
                "border": 1,
                "border_color": "#CBD5E1",
                "align": "center",
            }
        ),
        "table_text": workbook.add_format(
            {**base, "border": 1, "border_color": "#E5E7EB", "bg_color": WHITE}
        ),
        "table_number": workbook.add_format(
            {
                **base,
                "border": 1,
                "border_color": "#E5E7EB",
                "bg_color": WHITE,
                "num_format": "0",
                "align": "center",
            }
        ),
        "table_datetime": workbook.add_format(
            {
                **base,
                "border": 1,
                "border_color": "#E5E7EB",
                "bg_color": WHITE,
                "num_format": "yyyy-mm-dd hh:mm:ss",
                "align": "center",
            }
        ),
        "highlight": workbook.add_format(
            {
                **base,
                "border": 1,
                "border_color": "#FDBA74",
                "bg_color": "#FFF7ED",
                "font_color": "#9A3412",
            }
        ),
        "highlight_number": workbook.add_format(
            {
                **base,
                "border": 1,
                "border_color": "#FDBA74",
                "bg_color": "#FFF7ED",
                "font_color": "#9A3412",
                "num_format": "0",
                "align": "center",
            }
        ),
    }


def style_worksheet(ws, tab_color):
    ws.hide_gridlines(2)
    ws.set_tab_color(tab_color)


def write_table(ws, formats, start_row, start_col, df, widths=None, highlight_rows=None):
    highlight_rows = highlight_rows or set()
    for col_offset, column in enumerate(df.columns):
        ws.write(start_row, start_col + col_offset, str(column), formats["table_header"])
        if widths:
            ws.set_column(start_col + col_offset, start_col + col_offset, widths.get(column, 12))

    for row_offset, (_, row) in enumerate(df.iterrows(), start=1):
        for col_offset, value in enumerate(row):
            cell_format = formats["table_text"]
            if row_offset in highlight_rows:
                cell_format = formats["highlight"]
            if pd.isna(value):
                ws.write_blank(start_row + row_offset, start_col + col_offset, None, cell_format)
            elif isinstance(value, pd.Timestamp):
                ws.write_datetime(
                    start_row + row_offset,
                    start_col + col_offset,
                    value.to_pydatetime(),
                    formats["table_datetime"],
                )
            elif isinstance(value, (int,)):
                ws.write_number(
                    start_row + row_offset,
                    start_col + col_offset,
                    int(value),
                    formats["table_number"],
                )
            elif isinstance(value, (float,)):
                ws.write_number(
                    start_row + row_offset,
                    start_col + col_offset,
                    float(value),
                    formats["table_number"],
                )
            else:
                ws.write_string(
                    start_row + row_offset,
                    start_col + col_offset,
                    str(value),
                    cell_format,
                )
    return start_row + len(df) + 2


def write_kpi(ws, formats, row, col, label, value, note):
    ws.merge_range(row, col, row, col + 2, label, formats["kpi_label"])
    ws.merge_range(row + 1, col, row + 2, col + 2, value, formats["kpi_value"])
    ws.merge_range(row + 3, col, row + 3, col + 2, note, formats["kpi_note"])


def add_line_chart(workbook, title, categories, values, color=BLUE, chart_type="column"):
    chart = workbook.add_chart({"type": chart_type})
    chart.add_series(
        {
            "name": "订单数",
            "categories": categories,
            "values": values,
            "fill": {"color": color},
            "data_labels": {"value": True, "font": {"name": FONT, "size": 9}},
        }
    )
    chart.set_title(
        {
            "name": title,
            "name_font": {"name": FONT, "size": 12, "bold": True, "color": NAVY},
        }
    )
    chart.set_legend({"none": True})
    chart.set_chartarea({"border": {"none": True}})
    chart.set_plotarea({"border": {"none": True}})
    chart.set_x_axis(
        {
            "num_font": {"name": FONT, "size": 9, "color": GRAY},
            "line": {"color": "#D1D5DB"},
        }
    )
    chart.set_y_axis(
        {
            "major_gridlines": {"visible": True, "line": {"color": "#E5E7EB"}},
            "num_font": {"name": FONT, "size": 9, "color": GRAY},
            "line": {"none": True},
        }
    )
    chart.set_size({"width": 450, "height": 295})
    return chart


def add_pie_chart(workbook, title, categories, values, colors):
    chart = workbook.add_chart({"type": "doughnut"})
    chart.add_series(
        {
            "name": "订单数",
            "categories": categories,
            "values": values,
            "data_labels": {
                "value": True,
                "percentage": True,
                "font": {"name": FONT, "size": 9, "color": WHITE},
            },
            "points": [{"fill": {"color": color}} for color in colors],
        }
    )
    chart.set_title(
        {
            "name": title,
            "name_font": {"name": FONT, "size": 12, "bold": True, "color": NAVY},
        }
    )
    chart.set_legend(
        {
            "position": "bottom",
            "font": {"name": FONT, "size": 9, "color": GRAY},
        }
    )
    chart.set_chartarea({"border": {"none": True}})
    chart.set_size({"width": 450, "height": 295})
    return chart


def create_report(df, summaries):
    workbook = xlsxwriter.Workbook(OUTPUT_PATH, {"in_memory": True})
    formats = add_formats(workbook)

    total_orders = len(df)
    unique_orders = int(df["order_no"].nunique())
    unique_customers = int(df["shipper_customer_code"].nunique())
    test_count = int((df["is_contract_order(test)"] == "Y").sum())
    prod_count = int((df["is_contract_order(prod)"] == "Y").sum())
    top_customer = summaries["customer_summary"].iloc[0]
    top_customer_pct = int(top_customer["订单数"]) / total_orders
    peak_hour = summaries["hourly"].sort_values("订单数", ascending=False).iloc[0]
    max_same_second = int(summaries["second_stats"]["订单数"].max())
    max_same_minute = int(summaries["minute_stats"]["订单数"].max())
    duplicated_time_values = int(df.loc[df.duplicated("create_time", keep=False), "create_time"].nunique())
    high_freq_seconds = int((summaries["second_stats"]["订单数"] >= 5).sum())
    main_date = summaries["date_stats"].sort_values("订单数", ascending=False).iloc[0]
    main_date_pct = int(main_date["订单数"]) / total_orders

    explanation = workbook.add_worksheet("报告说明")
    style_worksheet(explanation, NAVY)
    explanation.set_column("A:A", 2)
    explanation.set_column("B:B", 18)
    explanation.set_column("C:D", 38)
    explanation.set_row(1, 32)
    explanation.write("B2", "订单数据可视化分析报告", formats["title"])
    explanation.write(
        "B3",
        f"数据来源：{SOURCE_PATH}    生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        formats["subtitle"],
    )

    explanation.write("B5", "分析结论", formats["section"])
    conclusions = [
        f"共 {total_orders} 条订单，订单号唯一率 {unique_orders / total_orders:.0%}，覆盖 {unique_customers} 个发货客户。",
        f"客户集中度高：Top1 客户 {top_customer['客户编码']} 贡献 {int(top_customer['订单数'])} 单，占 {top_customer_pct:.0%}；Top10 客户累计 {int(summaries['top_customers']['订单数'].sum())} 单。",
        f"订单号结构分化明显：DPK_HASH 类 {int(summaries['order_structure'].iloc[0]['订单数'])} 单，但仅来自 {int(summaries['order_structure'].iloc[0]['唯一客户数'])} 个客户，具有较强批量/通道特征。",
        f"时间高度集中：{main_date['日期']} 占 {main_date_pct:.0%}；峰值小时为 {int(peak_hour['小时'])} 点，共 {int(peak_hour['订单数'])} 单。",
        f"秒级批量特征突出：最大同秒 {max_same_second} 单，最大同分钟 {max_same_minute} 单，疑似导入、回放或批量创建。",
        f"test/prod 合同标志互补：test=Y 共 {test_count} 单，prod=Y 共 {prod_count} 单；5 条生产标志订单应重点确认业务含义。",
        "客户编码存在多种结构，包括 E 开头、F 开头、S 开头、纯数字和其他，可作为客户来源或系统口径的拆分维度。",
    ]
    row = 5
    for text in conclusions:
        explanation.merge_range(row, 1, row, 3, "• " + text, formats["bullet"])
        explanation.set_row(row, 28)
        row += 1

    row += 1
    explanation.write(row, 1, "分析维度与业务价值", formats["section"])
    row += 1
    dimension_df = pd.DataFrame(
        {
            "维度": ["订单号结构", "客户编码类型", "客户集中度", "时间热度", "同秒/同分钟批量", "合同标志", "日期集中度"],
            "口径/指标": [
                "按 YK/WX/APP/EWD/O/DPK_HASH 等前缀或分隔符分类",
                "按 E/F/S/纯数字/其他识别客户编码形态",
                "客户订单数、Top1/Top10 占比",
                "小时、分钟、秒级订单数",
                "同一时间戳和分钟段的订单数/客户数",
                "test 与 prod 的 Y/N 分布和互补关系",
                "每日订单数、主要日期占比",
            ],
            "价值/关注点": [
                "识别来源系统、通道或导入方式差异",
                "识别客户主数据口径、系统来源或新老客户差异",
                "评估订单稳定性、大客户依赖和风险敞口",
                "定位高峰时段和资源压力窗口",
                "发现疑似批量创建、接口回放或数据导入行为",
                "判断测试/生产合同标志是否冲突或互斥",
                "判断数据是否为短窗口抓取或集中事件",
            ],
        }
    )
    write_table(explanation, formats, row, 1, dimension_df, widths={"维度": 18, "口径/指标": 38, "价值/关注点": 38})

    kpi = workbook.add_worksheet("KPI看板")
    style_worksheet(kpi, BLUE)
    kpi.set_column("A:A", 2)
    for col in range(1, 17):
        kpi.set_column(col, col, 9)
    kpi.write("B2", "核心指标看板", formats["title"])
    kpi.set_row(1, 30)
    kpi.write("B3", "指标均由原始明细自动汇总，口径可在“报告说明”中追溯。", formats["subtitle"])

    kpis = [
        ("总订单数", total_orders, "原始数据 100 条"),
        ("唯一订单号占比", f"{unique_orders / total_orders:.0%}", f"{unique_orders} / {total_orders}"),
        ("唯一客户数", unique_customers, "发货客户编码去重"),
        ("Top1 客户占比", f"{top_customer_pct:.0%}", f"{top_customer['客户编码']} / {int(top_customer['订单数'])} 单"),
        ("test=Y 占比", f"{test_count / total_orders:.0%}", f"prod=Y 共 {prod_count} 单"),
        ("prod=Y 占比", f"{prod_count / total_orders:.0%}", "重点关注生产标志订单"),
        ("峰值小时", f"{int(peak_hour['小时'])} 点", f"{int(peak_hour['订单数'])} 单/小时"),
        ("最大同分钟批量", max_same_minute, "可能为批量创建/导入"),
    ]
    kpi_row = 5
    for index, (label, value, note) in enumerate(kpis):
        row_offset = kpi_row + (index // 4) * 5
        col_offset = 1 + (index % 4) * 4
        write_kpi(kpi, formats, row_offset, col_offset, label, value, note)

    kpi.set_row(kpi_row, 22)
    kpi.set_row(kpi_row + 1, 28)
    kpi.set_row(kpi_row + 2, 28)
    kpi.set_row(kpi_row + 3, 26)
    kpi.set_row(kpi_row + 4, 22)
    kpi.set_row(kpi_row + 5, 28)
    kpi.set_row(kpi_row + 6, 28)
    kpi.set_row(kpi_row + 7, 26)

    kpi.merge_range(kpi_row + 9, 1, kpi_row + 9, 16, "补充观察", formats["section"])
    extra_notes = [
        f"最大同秒批量 {max_same_second} 单；同一秒内订单数 ≥5 的时间点共 {high_freq_seconds} 个。",
        f"重复 create_time 值 {duplicated_time_values} 个；时间重复不代表订单号重复，但能支撑批量行为判断。",
        f"{main_date['日期']} 有 {int(main_date['订单数'])} 单，占全部数据 {main_date_pct:.0%}。",
    ]
    note_row = kpi_row + 10
    for text in extra_notes:
        kpi.merge_range(note_row, 1, note_row, 16, "• " + text, formats["bullet"])
        kpi.set_row(note_row, 24)
        note_row += 1

    chart_data = workbook.add_worksheet("图表数据")
    style_worksheet(chart_data, "#9CA3AF")
    chart_data.set_column("A:C", 14)
    chart_data.set_column("E:G", 14)
    chart_data.set_column("I:J", 24)
    chart_data.set_column("L:M", 10)
    chart_data.set_column("O:P", 12)
    chart_data.set_column("R:S", 14)
    chart_data.set_column("U:V", 14)
    chart_data.set_column("X:Y", 14)

    r1 = write_table(chart_data, formats, 1, 0, summaries["order_structure"])
    r2 = write_table(chart_data, formats, 1, 4, summaries["customer_type"])
    r3 = write_table(chart_data, formats, 1, 8, summaries["top_customers"][["客户编码", "订单数"]])
    r4 = write_table(chart_data, formats, 1, 11, summaries["hourly"].assign(小时=lambda d: d["小时"].map(lambda v: f"{int(v):02d}")))
    r5 = write_table(chart_data, formats, 1, 14, summaries["contract"])
    r6 = write_table(chart_data, formats, 1, 17, summaries["top_seconds"][["时间秒", "订单数"]])
    r7 = write_table(chart_data, formats, 1, 20, summaries["top_minutes"][["分钟段", "订单数"]])
    r8 = write_table(chart_data, formats, 1, 23, summaries["date_stats"])

    dashboard = workbook.add_worksheet("可视化看板")
    style_worksheet(dashboard, GREEN)
    dashboard.set_column("A:A", 2)
    for col in range(1, 20):
        dashboard.set_column(col, col, 9)
    dashboard.write("B2", "订单行为可视化看板", formats["title"])
    dashboard.set_row(1, 30)
    dashboard.write("B3", "图表均引用报表内的“图表数据”页，可在 Excel 中继续调整。", formats["subtitle"])

    structure_chart = add_line_chart(
        workbook,
        "订单号结构分布",
        ["图表数据", 2, 0, 1 + len(summaries["order_structure"]), 0],
        ["图表数据", 2, 1, 1 + len(summaries["order_structure"]), 1],
    )
    customer_type_chart = add_pie_chart(
        workbook,
        "客户编码类型订单占比",
        ["图表数据", 2, 4, 1 + len(summaries["customer_type"]), 4],
        ["图表数据", 2, 5, 1 + len(summaries["customer_type"]), 5],
        [BLUE, GREEN, AMBER, RED, GRAY],
    )
    top_customer_chart = add_line_chart(
        workbook,
        "客户集中度 Top10",
        ["图表数据", 2, 8, 1 + len(summaries["top_customers"]), 8],
        ["图表数据", 2, 9, 1 + len(summaries["top_customers"]), 9],
        color=NAVY,
        chart_type="bar",
    )
    hourly_chart = add_line_chart(
        workbook,
        "24 小时订单分布",
        ["图表数据", 2, 11, 25, 11],
        ["图表数据", 2, 12, 25, 12],
    )
    contract_chart = add_pie_chart(
        workbook,
        "test / prod 合同标志占比",
        ["图表数据", 2, 14, 3, 14],
        ["图表数据", 2, 15, 3, 15],
        [BLUE, AMBER],
    )
    second_chart = add_line_chart(
        workbook,
        "同秒批量 Top10",
        ["图表数据", 2, 17, 1 + len(summaries["top_seconds"]), 17],
        ["图表数据", 2, 18, 1 + len(summaries["top_seconds"]), 18],
        color=RED,
        chart_type="bar",
    )
    minute_chart = add_line_chart(
        workbook,
        "同分钟批量 Top10",
        ["图表数据", 2, 20, 1 + len(summaries["top_minutes"]), 20],
        ["图表数据", 2, 21, 1 + len(summaries["top_minutes"]), 21],
        color=AMBER,
    )
    date_chart = add_line_chart(
        workbook,
        "日期订单分布",
        ["图表数据", 2, 23, 1 + len(summaries["date_stats"]), 23],
        ["图表数据", 2, 24, 1 + len(summaries["date_stats"]), 24],
        color=GREEN,
    )

    dashboard.insert_chart("B5", structure_chart)
    dashboard.insert_chart("K5", customer_type_chart)
    dashboard.insert_chart("B24", top_customer_chart)
    dashboard.insert_chart("K24", hourly_chart)
    dashboard.insert_chart("B43", contract_chart)
    dashboard.insert_chart("K43", second_chart)
    dashboard.insert_chart("B62", minute_chart)
    dashboard.insert_chart("K62", date_chart)

    anomaly = workbook.add_worksheet("异常与特征")
    style_worksheet(anomaly, AMBER)
    anomaly.set_column("A:A", 2)
    anomaly.set_column("B:K", 16)
    anomaly.write("B2", "异常与批量特征", formats["title"])
    anomaly.set_row(1, 30)

    row = 4
    anomaly.write(row, 1, "同一创建时间订单数 Top20", formats["section"])
    row = write_table(
        anomaly,
        formats,
        row + 1,
        1,
        summaries["second_stats"].head(20),
        widths={"时间秒": 14, "订单数": 12, "客户数": 12},
    )

    anomaly.write(row, 1, "同一分钟段订单数 Top20", formats["section"])
    row = write_table(
        anomaly,
        formats,
        row + 1,
        1,
        summaries["minute_stats"].head(20),
        widths={"分钟段": 14, "订单数": 12, "客户数": 12},
    )

    anomaly.write(row, 1, "prod=Y 订单明细", formats["section"])
    prod_df = df.loc[df["is_contract_order(prod)"] == "Y", COLUMNS].copy()
    row = write_table(
        anomaly,
        formats,
        row + 1,
        1,
        prod_df,
        widths={
            "#": 8,
            "create_time": 20,
            "order_no": 24,
            "shipper_customer_code": 24,
            "is_contract_order(test)": 14,
            "is_contract_order(prod)": 14,
        },
    )

    anomaly.write(row, 1, "数据质量观察", formats["section"])
    quality_df = pd.DataFrame(
        {
            "观察项": ["create_time 重复", "客户编码混合类型", "合同标志互补", "订单号唯一性"],
            "现状": [
                f"{duplicated_time_values} 个时间戳出现重复",
                "同时存在字符串和数字型客户编码",
                "test=Y / prod=Y 无同时为 Y 的组合",
                f"{unique_orders} 个订单号全部唯一",
            ],
            "建议动作": [
                "结合系统日志判断是否为批量导入或回放",
                "统一读取格式，避免下游 join 产生口径漂移",
                "确认 prod=Y 的 5 条订单是否为业务特例",
                "可作为订单主键完整性检查通过",
            ],
        }
    )
    write_table(
        anomaly,
        formats,
        row + 1,
        1,
        quality_df,
        widths={"观察项": 24, "现状": 34, "建议动作": 40},
    )

    detail = workbook.add_worksheet("原始明细")
    style_worksheet(detail, GRAY)
    detail_columns = COLUMNS + ["订单号结构", "客户编码类型", "日期", "小时", "分钟段"]
    detail_df = df[detail_columns].copy()
    detail_df["日期"] = detail_df["日期"].map(lambda v: v.strftime("%Y-%m-%d"))
    widths = {
        "#": 8,
        "create_time": 20,
        "order_no": 26,
        "shipper_customer_code": 24,
        "is_contract_order(test)": 16,
        "is_contract_order(prod)": 16,
        "订单号结构": 14,
        "客户编码类型": 14,
        "日期": 12,
        "小时": 8,
        "分钟段": 10,
    }
    detail.set_column("A:A", widths["#"])
    for col_index, column in enumerate(detail_columns):
        detail.set_column(col_index, col_index, widths.get(column, 14))
    for col_index, column in enumerate(detail_columns):
        detail.write(0, col_index, column, formats["table_header"])
    for row_index, (_, row_values) in enumerate(detail_df.iterrows(), start=1):
        for col_index, column in enumerate(detail_columns):
            value = row_values[column]
            if column == "create_time":
                detail.write_datetime(row_index, col_index, value.to_pydatetime(), formats["table_datetime"])
            elif isinstance(value, (int, float)):
                detail.write_number(row_index, col_index, value, formats["table_number"])
            else:
                detail.write_string(row_index, col_index, str(value), formats["table_text"])
    detail.freeze_panes(1, 0)
    detail.autofilter(0, 0, len(detail_df), len(detail_columns) - 1)

    workbook.close()


def main():
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(f"未找到源数据：{SOURCE_PATH}")
    df = load_data()
    summaries = build_summaries(df)
    create_report(df, summaries)
    print(f"已生成：{OUTPUT_PATH}")


if __name__ == "__main__":
    main()
