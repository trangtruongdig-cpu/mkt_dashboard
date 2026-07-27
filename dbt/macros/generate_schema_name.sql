{#
    Mặc định dbt nối tên lược đồ: `<schema trong profile>_<schema khai trong model>`,
    cho ra `public_stg` thay vì `stg`. Ba lược đồ raw/stg/mart đã được tạo sẵn lúc
    khởi tạo PostgreSQL và là ranh giới sở hữu rõ ràng, nên ghi đè để dùng đúng tên.
#}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if custom_schema_name is none -%}
        {{ target.schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
